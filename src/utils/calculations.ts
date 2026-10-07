import type { Dispatch, Payment, TaxMethod, AppSettings } from "../types";
import { getCachedSettings } from "../lib/db";

export interface SettlementResult {
  gcvDeduction: number;
  sulphurDeduction: number;
  adjustedRate: number;
  taxDeduction: number;
  netRate: number;
  payableRate: number;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  taxMethod?: TaxMethod;
}

export interface PartyBalanceResult {
  totalBilled: number;
  totalPaymentsReceived: number;
  totalPaymentsPaid: number;
  netPaymentsReceived: number;
  outstandingBalance: number;
  isReceivable: boolean;
  isAdvance: boolean;
  isCleared: boolean;
  totalTons: number;
  totalProfit: number;
  dispatchesCount: number;
  paymentsCount: number;
}

function cleanNum(val: any, fallback = 0): number {
  if (typeof val === 'number') {
    return isNaN(val) || !isFinite(val) ? fallback : val;
  }
  if (val === null || val === undefined || val === '') {
    return fallback;
  }
  const str = String(val).replace(/,/g, '').trim();
  if (str === '') return fallback;
  const p = Number(str);
  return isNaN(p) || !isFinite(p) ? fallback : p;
}

export function calculateSettlement(dispatch: Dispatch, settings?: AppSettings | null): SettlementResult {
  if (!dispatch) {
    return {
      gcvDeduction: 0,
      sulphurDeduction: 0,
      adjustedRate: 0,
      taxDeduction: 0,
      netRate: 0,
      payableRate: 0,
      totalRevenue: 0,
      totalCost: 0,
      netProfit: 0,
      taxMethod: 'manual',
    };
  }

  const baseRate = cleanNum(dispatch.baseRate);
  const labReceivedWeight = cleanNum(dispatch.labReceivedWeight);
  const manualDeduction = cleanNum(dispatch.manualDeduction);
  const manualPremium = cleanNum(dispatch.manualPremium);
  const manualTax = cleanNum(dispatch.manualTax);
  const commissionPerTon = cleanNum(dispatch.commissionPerTon);
  const overheads = dispatch.overheads || ({} as any);
  const coalInputs = Array.isArray(dispatch.coalInputs) ? dispatch.coalInputs : [];

  // 1. Calculate Adjusted Rate: Base Rate - Manual Deduction + Manual Premium
  const adjustedRate = baseRate - manualDeduction + manualPremium;

  // 2. Determine Tax Deduction:
  //    - If taxMethod === 'manual', use manualTax.
  //    - If taxMethod === 'formula_18_5', automatically calculate using (Adjusted Rate + salesTax%) * incomeTax%.
  //    - Prioritize the dispatch's own frozen snapshot factors to preserve historical immutability.
  const appSettings = settings || getCachedSettings();
  const isExistingSaved = Boolean(dispatch.id);

  const salesPercent = typeof dispatch.taxSalesPercent === 'number'
    ? dispatch.taxSalesPercent
    : (isExistingSaved
        ? 18
        : (typeof appSettings?.taxFormulaSalesPercent === 'number'
            ? appSettings.taxFormulaSalesPercent
            : 18));

  const incomePercent = typeof dispatch.taxIncomePercent === 'number'
    ? dispatch.taxIncomePercent
    : (isExistingSaved
        ? 5
        : (typeof appSettings?.taxFormulaIncomePercent === 'number'
            ? appSettings.taxFormulaIncomePercent
            : 5));

  const activeTaxMethod: TaxMethod = dispatch.taxMethod || 'manual';
  const taxDeduction =
    activeTaxMethod === 'formula_18_5'
      ? (adjustedRate * (1 + salesPercent / 100)) * (incomePercent / 100)
      : manualTax;

  // 3. Calculate Payable Rate: Adjusted Rate - Tax Deduction - Commission
  const payableRate = adjustedRate - taxDeduction - commissionPerTon;

  // Total Revenue: Final Payable Rate × Received Weight
  const totalRevenue = payableRate * labReceivedWeight;

  // Total Cost: Sum of (Coal Recipe Weights × Buy Prices) + Sum of Expenses (Loading, Transport, Crushing, Royalty, Other)
  const totalCoalCost = coalInputs.reduce((sum, input) => sum + (cleanNum(input?.weight) * cleanNum(input?.purchaseRate)), 0);
  const totalOverheads = cleanNum(overheads.loading) + cleanNum(overheads.freight) + cleanNum(overheads.crush) + cleanNum(overheads.royalty) + cleanNum(overheads.other);
  
  const totalCost = totalCoalCost + totalOverheads;

  // Final Profit/Loss: Total Revenue - Total Cost
  const netProfit = totalRevenue - totalCost;

  return {
    gcvDeduction: manualDeduction, 
    sulphurDeduction: 0,
    adjustedRate: cleanNum(adjustedRate),
    taxDeduction: cleanNum(taxDeduction),
    netRate: cleanNum(payableRate + commissionPerTon),
    payableRate: cleanNum(payableRate),
    totalRevenue: cleanNum(totalRevenue),
    totalCost: cleanNum(totalCost),
    netProfit: cleanNum(netProfit),
    taxMethod: activeTaxMethod,
  };
}


/**
 * Canonical unified financial balance calculation for a party account.
 * Follows double-entry business ledger rules:
 * - Dispatches are Debits (invoiced receivables from the party).
 * - Received Payments are Credits (cash/bank received from the party).
 * - Paid Payments are Debits (cash/refunds paid to the party).
 * Net Received = Total Received - Total Paid Out.
 * Outstanding Balance = Total Billed - Net Received.
 */
export function calculatePartyBalance(dispatches: Dispatch[], payments: Payment[]): PartyBalanceResult {
  const safeDispatches = Array.isArray(dispatches) ? dispatches : [];
  const safePayments = Array.isArray(payments) ? payments : [];

  const totalBilled = safeDispatches.reduce((sum, d) => sum + cleanNum(calculateSettlement(d).totalRevenue), 0);
  const totalProfit = safeDispatches.reduce((sum, d) => sum + cleanNum(calculateSettlement(d).netProfit), 0);
  const totalTons = safeDispatches.reduce((sum, d) => sum + cleanNum(d?.labReceivedWeight), 0);

  const totalPaymentsReceived = safePayments
    .filter((p) => (p.type === 'received' || (p as any).paymentType === 'received'))
    .reduce((sum, p) => sum + cleanNum(p.amount), 0);

  const totalPaymentsPaid = safePayments
    .filter((p) => (p.type === 'paid' || (p as any).paymentType === 'paid'))
    .reduce((sum, p) => sum + cleanNum(p.amount), 0);

  const netPaymentsReceived = totalPaymentsReceived - totalPaymentsPaid;
  const outstandingBalance = Math.round(totalBilled - netPaymentsReceived);

  const isCleared = dispatches.length > 0 && Math.abs(outstandingBalance) < 50;
  const isReceivable = outstandingBalance > 50;
  const isAdvance = outstandingBalance < -50;

  return {
    totalBilled,
    totalPaymentsReceived,
    totalPaymentsPaid,
    netPaymentsReceived,
    outstandingBalance,
    isReceivable,
    isAdvance,
    isCleared,
    totalTons,
    totalProfit,
    dispatchesCount: dispatches.length,
    paymentsCount: payments.length,
  };
}

/**
 * Calculates transit loss / shortage between loaded coal recipe weight and factory weighbridge received weight.
 */
export function calculateTransitLoss(dispatch: Dispatch): {
  totalLoadedWeight: number;
  receivedWeight: number;
  diff: number;
  isLoss: boolean;
  isGain: boolean;
  lossPercentage: number;
} {
  const totalLoadedWeight = (dispatch.coalInputs || []).reduce((sum, c) => sum + (c.weight || 0), 0);
  const receivedWeight = dispatch.labReceivedWeight || 0;
  const diff = receivedWeight - totalLoadedWeight;
  const isLoss = diff < -0.01;
  const isGain = diff > 0.01;
  const lossPercentage = totalLoadedWeight > 0 ? (Math.abs(diff) / totalLoadedWeight) * 100 : 0;

  return {
    totalLoadedWeight,
    receivedWeight,
    diff,
    isLoss,
    isGain,
    lossPercentage,
  };
}

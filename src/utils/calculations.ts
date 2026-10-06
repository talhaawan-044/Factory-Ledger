import type { Dispatch, Payment, TaxMethod } from "../types";

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

export function calculateSettlement(dispatch: Dispatch): SettlementResult {
  const {
    baseRate = 0,
    labReceivedWeight = 0,
    overheads = { loading: 0, freight: 0, crush: 0, royalty: 0, other: 0 },
    coalInputs = [],
    manualDeduction = 0,
    manualPremium = 0,
    manualTax = 0,
    taxMethod = 'manual',
    commissionPerTon = 0,
  } = dispatch;

  // 1. Calculate Adjusted Rate: Base Rate - Manual Deduction + Manual Premium
  const adjustedRate = baseRate - manualDeduction + manualPremium;

  // 2. Determine Tax Deduction:
  //    - If taxMethod === 'manual', use the manualTax value provided by the user.
  //    - If taxMethod === 'formula_18_5', automatically calculate it using this exact formula: (Adjusted Rate * 1.18) * 0.05
  const activeTaxMethod: TaxMethod = taxMethod || 'manual';
  const taxDeduction =
    activeTaxMethod === 'formula_18_5'
      ? (adjustedRate * 1.18) * 0.05
      : (manualTax || 0);

  // 3. Calculate Payable Rate: Adjusted Rate - Tax Deduction - Commission
  const payableRate = adjustedRate - taxDeduction - commissionPerTon;

  // Total Revenue: Final Payable Rate × Received Weight
  const totalRevenue = payableRate * labReceivedWeight;

  // Total Cost: Sum of (Coal Recipe Weights × Buy Prices) + Sum of Expenses (Loading, Transport, Crushing, Royalty, Other)
  const totalCoalCost = coalInputs.reduce((sum, input) => sum + ((input.weight || 0) * (input.purchaseRate || 0)), 0);
  const totalOverheads = (overheads.loading || 0) + (overheads.freight || 0) + (overheads.crush || 0) + (overheads.royalty || 0) + (overheads.other || 0);
  
  const totalCost = totalCoalCost + totalOverheads;

  // Final Profit/Loss: Total Revenue - Total Cost
  const netProfit = totalRevenue - totalCost;

  return {
    gcvDeduction: manualDeduction, 
    sulphurDeduction: 0,
    adjustedRate,
    taxDeduction,
    netRate: payableRate + commissionPerTon,
    payableRate,
    totalRevenue,
    totalCost,
    netProfit,
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
  const totalBilled = dispatches.reduce((sum, d) => sum + calculateSettlement(d).totalRevenue, 0);
  const totalProfit = dispatches.reduce((sum, d) => sum + calculateSettlement(d).netProfit, 0);
  const totalTons = dispatches.reduce((sum, d) => sum + (d.labReceivedWeight || 0), 0);

  const totalPaymentsReceived = payments
    .filter((p) => p.type === 'received')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalPaymentsPaid = payments
    .filter((p) => p.type === 'paid')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

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

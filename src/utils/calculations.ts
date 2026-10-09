import type { Dispatch, Payment, TaxMethod, AppSettings, InventoryLot, Mine } from "../types";
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
  gcvPremium?: number;
  isProrata?: boolean;
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

  // Pro-rata GCV pricing calculation (contract rule on PO / dispatch)
  const isProrata = dispatch.gcvAdjustment === 'prorata';
  let effectiveDeduction = manualDeduction;
  let effectivePremium = manualPremium;

  if (isProrata) {
    const targetGcv = cleanNum(dispatch.targetGcv);
    const labActualGcv = cleanNum(dispatch.labActualGcv);
    const rounding = dispatch.gcvAdjustmentRounding || 'paisa';

    if (targetGcv > 0 && baseRate > 0 && labActualGcv > 0) {
      if (labActualGcv < targetGcv) {
        const raw = baseRate * (1 - (labActualGcv / targetGcv));
        effectiveDeduction = rounding === 'rupee' ? Math.round(raw) : Number(raw.toFixed(2));
        effectivePremium = 0;
      } else if (labActualGcv > targetGcv) {
        const raw = baseRate * ((labActualGcv / targetGcv) - 1);
        effectivePremium = rounding === 'rupee' ? Math.round(raw) : Number(raw.toFixed(2));
        effectiveDeduction = 0;
      } else {
        effectiveDeduction = 0;
        effectivePremium = 0;
      }
    }
  }

  // 1. Calculate Adjusted Rate: Base Rate - GCV Deduction + GCV Premium
  const adjustedRate = baseRate - effectiveDeduction + effectivePremium;

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
    gcvDeduction: cleanNum(effectiveDeduction), 
    sulphurDeduction: 0,
    adjustedRate: cleanNum(adjustedRate),
    taxDeduction: cleanNum(taxDeduction),
    netRate: cleanNum(payableRate + commissionPerTon),
    payableRate: cleanNum(payableRate),
    totalRevenue: cleanNum(totalRevenue),
    totalCost: cleanNum(totalCost),
    netProfit: cleanNum(netProfit),
    taxMethod: activeTaxMethod,
    gcvPremium: cleanNum(effectivePremium),
    isProrata,
  };
}


/**
 * Checks whether a dispatch is pending (in-transit / unweighed).
 * Dispatches marked 'pending' or with 0 received weight are excluded from aggregate profit
 * to prevent artificial deficits before weighbridge confirmation (Issue 19 / T6).
 */
export function isDispatchPending(dispatch: Dispatch): boolean {
  if (!dispatch) return false;
  if (dispatch.status === 'pending') return true;
  if (dispatch.status === 'settled') return false;
  return cleanNum(dispatch.labReceivedWeight) === 0;
}

export interface LedgerTotals {
  settledCount: number;
  pendingCount: number;
  revenue: number;          // settled only
  cost: number;             // settled only
  profit: number;           // settled only
  receivedTons: number;     // settled only
  loadedTonsSettled: number;
  transitDiffTons: number;  // settled only: received - loaded
  pendingLoadedTons: number; // on the road, shown separately
}

/**
 * Single canonical ledger aggregator for all dispatches across the application (Issue 20).
 * Prevents in-transit / unweighed dispatches from creating artificial revenue deficits or transit losses.
 */
export function calculateLedgerTotals(dispatches: Dispatch[], settings?: AppSettings | null): LedgerTotals {
  const live = (dispatches || []).filter((d) => !d?.deleted);
  const settled = live.filter((d) => !isDispatchPending(d));
  const pending = live.filter((d) => isDispatchPending(d));

  let revenue = 0;
  let cost = 0;
  let profit = 0;
  let receivedTons = 0;
  let loadedTonsSettled = 0;

  for (const d of settled) {
    const s = calculateSettlement(d, settings);
    revenue += s.totalRevenue;
    cost += s.totalCost;
    profit += s.netProfit;
    const t = calculateTransitLoss(d);
    receivedTons += t.receivedWeight;
    loadedTonsSettled += t.totalLoadedWeight;
  }

  const pendingLoadedTons = pending.reduce(
    (sum, d) => sum + (d.coalInputs || []).reduce((cSum, c) => cSum + cleanNum(c?.weight), 0),
    0
  );

  return {
    settledCount: settled.length,
    pendingCount: pending.length,
    revenue: cleanNum(revenue),
    cost: cleanNum(cost),
    profit: cleanNum(profit),
    receivedTons: cleanNum(receivedTons),
    loadedTonsSettled: cleanNum(loadedTonsSettled),
    transitDiffTons: cleanNum(receivedTons - loadedTonsSettled),
    pendingLoadedTons: cleanNum(pendingLoadedTons),
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

  const totals = calculateLedgerTotals(safeDispatches);

  const totalBilled = totals.revenue;
  const totalProfit = totals.profit;
  const totalTons = totals.receivedTons;

  const totalPaymentsReceived = safePayments
    .filter((p) => !p?.deleted && (p.type === 'received' || (p as any).paymentType === 'received'))
    .reduce((sum, p) => sum + cleanNum(p.amount), 0);

  const totalPaymentsPaid = safePayments
    .filter((p) => !p?.deleted && (p.type === 'paid' || (p as any).paymentType === 'paid'))
    .reduce((sum, p) => sum + cleanNum(p.amount), 0);

  const netPaymentsReceived = totalPaymentsReceived - totalPaymentsPaid;
  const outstandingBalance = Math.round(totalBilled - netPaymentsReceived);

  const nonDeletedDispatches = safeDispatches.filter((d) => !d?.deleted);
  const nonDeletedPayments = safePayments.filter((p) => !p?.deleted);

  const isCleared = nonDeletedDispatches.length > 0 && Math.abs(outstandingBalance) < 50;
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
    dispatchesCount: nonDeletedDispatches.length,
    paymentsCount: nonDeletedPayments.length,
  };
}

/**
 * Calculates transit loss / shortage between loaded coal recipe weight and factory weighbridge received weight.
 * Handles in-transit (pending) trucks by setting isLoss to false and diff/lossPercentage to 0 (Issue 20).
 */
export function calculateTransitLoss(dispatch: Dispatch): {
  totalLoadedWeight: number;
  receivedWeight: number;
  diff: number;
  isLoss: boolean;
  isGain: boolean;
  lossPercentage: number;
  isPending: boolean;
} {
  const isPending = isDispatchPending(dispatch);
  const totalLoadedWeight = (dispatch?.coalInputs || []).reduce((sum, c) => sum + cleanNum(c?.weight), 0);
  const receivedWeight = isPending ? 0 : cleanNum(dispatch?.labReceivedWeight);
  const diff = isPending ? 0 : (receivedWeight - totalLoadedWeight);
  const isLoss = !isPending && diff < -0.01;
  const isGain = !isPending && diff > 0.01;
  const lossPercentage = (!isPending && totalLoadedWeight > 0) ? (Math.abs(diff) / totalLoadedWeight) * 100 : 0;

  return {
    totalLoadedWeight: cleanNum(totalLoadedWeight),
    receivedWeight: cleanNum(receivedWeight),
    diff: cleanNum(diff),
    isLoss,
    isGain,
    lossPercentage: cleanNum(lossPercentage),
    isPending,
  };
}

export interface LotStockInfo {
  lot: InventoryLot;
  usedWeight: number;
  dispatchedWeight: number;
  remainingWeight: number;
  isOverdrawn: boolean;
  capitalTiedUp: number;
}

/**
 * Calculates purchase total cost and landed cost per received ton.
 * Formula: totalCost = billedWeight * purchaseRate
 * landedRate = receivedWeight > 0 ? totalCost / receivedWeight : purchaseRate
 * (e.g. 30 tons billed @ 20,000, 28.5 tons received -> 600,000 / 28.5 = 21,052.63)
 */
export function calculateLandedCost(billedWeight: number, receivedWeight: number, purchaseRate: number) {
  const bWeight = cleanNum(billedWeight);
  const rWeight = cleanNum(receivedWeight);
  const pRate = cleanNum(purchaseRate);
  const totalCost = bWeight * pRate;
  const landedRate = rWeight > 0 ? totalCost / rWeight : pRate;
  return {
    totalCost: Math.round(totalCost * 100) / 100,
    landedRate: Math.round(landedRate * 100) / 100,
  };
}

/**
 * Derives dynamic inventory stock for a lot based on coal input usages across all non-deleted dispatches.
 * Avoids storing mutable remaining stock in database to prevent multi-device race conditions and double-deductions.
 */
export function calculateLotStock(lot: InventoryLot, dispatches: Dispatch[]): LotStockInfo {
  const safeDispatches = Array.isArray(dispatches) ? dispatches : [];
  let usedWeight = 0;
  for (const d of safeDispatches) {
    if (d?.deleted) continue;
    if (Array.isArray(d?.coalInputs)) {
      for (const input of d.coalInputs) {
        if (input?.lotId === lot.id) {
          usedWeight += cleanNum(input.weight);
        }
      }
    }
  }
  const remainingWeight = cleanNum(lot.receivedWeight) - usedWeight;
  const isOverdrawn = remainingWeight < -0.001;
  const capitalTiedUp = remainingWeight > 0 ? remainingWeight * cleanNum(lot.landedRate) : 0;
  const roundedUsed = Math.round(usedWeight * 100) / 100;
  return {
    lot,
    usedWeight: roundedUsed,
    dispatchedWeight: roundedUsed,
    remainingWeight: Math.round(remainingWeight * 100) / 100,
    isOverdrawn,
    capitalTiedUp: Math.round(capitalTiedUp),
  };
}

/**
 * Aggregates overall inventory metrics (stock, capital, supplier breakdown).
 */
export function calculateInventoryTotals(lots: InventoryLot[], dispatches: Dispatch[]) {
  const activeLots = (lots || []).filter((l) => !l.deleted);
  let totalBilledTons = 0;
  let totalReceivedTons = 0;
  let totalUsedTons = 0;
  let totalRemainingTons = 0;
  let totalCapitalTiedUp = 0;
  let overdrawnLotsCount = 0;
  const supplierMap = new Map<string, { tons: number; capital: number; lotsCount: number }>();

  for (const lot of activeLots) {
    totalBilledTons += cleanNum(lot.billedWeight);
    totalReceivedTons += cleanNum(lot.receivedWeight);
    const stock = calculateLotStock(lot, dispatches);
    totalUsedTons += stock.usedWeight;
    totalRemainingTons += stock.remainingWeight;
    totalCapitalTiedUp += stock.capitalTiedUp;
    if (stock.isOverdrawn) {
      overdrawnLotsCount += 1;
    }

    const sName = lot.supplier?.trim() || 'Unknown Supplier';
    const existing = supplierMap.get(sName) || { tons: 0, capital: 0, lotsCount: 0 };
    existing.tons += stock.remainingWeight;
    existing.capital += stock.capitalTiedUp;
    existing.lotsCount += 1;
    supplierMap.set(sName, existing);
  }

  const avgLandedCost = totalRemainingTons > 0 ? totalCapitalTiedUp / totalRemainingTons : 0;
  const roundedRemaining = Math.round(totalRemainingTons * 100) / 100;

  return {
    totalBilledTons: Math.round(totalBilledTons * 100) / 100,
    totalReceivedTons: Math.round(totalReceivedTons * 100) / 100,
    totalUsedTons: Math.round(totalUsedTons * 100) / 100,
    totalRemainingTons: roundedRemaining,
    totalRemainingStock: roundedRemaining,
    totalCapitalTiedUp: Math.round(totalCapitalTiedUp),
    totalActiveLots: activeLots.length,
    overdrawnLotsCount,
    avgLandedCost: Math.round(avgLandedCost * 100) / 100,
    suppliers: Array.from(supplierMap.entries()).map(([name, data]) => ({
      name,
      ...data,
      avgCost: data.tons > 0 ? data.capital / data.tons : 0,
    })),
  };
}

export interface MineStockSummary {
  mine: Mine;
  totalInflowTons: number;
  totalInflowValue: number;
  totalOutflowTons: number;
  totalOutflowValue: number;
  remainingTons: number;
  remainingValue: number;
  isOverdrawn: boolean;
  entriesCount: number;
  dispatchesCount: number;
  status: 'in_stock' | 'low' | 'exhausted' | 'overdrawn';
}

/**
 * Calculates stock balance and financials for an individual Mine:
 * Inflow = Sum of all stock entries (lots) linked to this mine.
 * Outflow = Sum of all coal blending recipes consuming coal from this mine.
 * Remaining Stock = Inflow Tons - Outflow Tons.
 * Stock Value = Remaining Tons * Mine Rate Per Ton.
 */
export function calculateMineStock(
  mine: Mine,
  lots: InventoryLot[],
  dispatches: Dispatch[]
): MineStockSummary {
  const activeLots = (lots || []).filter(
    (l) =>
      !l.deleted &&
      (l.mineId === mine.id || (!l.mineId && (l.mineSource || l.mineName || '').trim().toLowerCase() === mine.name.trim().toLowerCase()))
  );

  let totalInflowTons = 0;
  let totalInflowValue = 0;

  for (const lot of activeLots) {
    const tons = cleanNum(lot.tonnage ?? (lot.receivedWeight || lot.billedWeight || 0));
    const rate = cleanNum(lot.ratePerTon ?? (lot.landedRate || lot.purchaseRate || mine.ratePerTon || 0));
    const val = lot.totalValue !== undefined ? cleanNum(lot.totalValue) : tons * rate;
    totalInflowTons += tons;
    totalInflowValue += val;
  }

  // Find all dispatches blending coal from this mine
  const activeDispatches = (dispatches || []).filter((d) => !d.deleted);
  let totalOutflowTons = 0;
  let linkedDispatchesCount = 0;

  for (const d of activeDispatches) {
    let dispatchUsedMine = false;
    if (Array.isArray(d.coalInputs)) {
      for (const ci of d.coalInputs) {
        const matchesMine =
          ci.mineId === mine.id ||
          (Boolean(ci.sourceName) && ci.sourceName.trim().toLowerCase() === mine.name.trim().toLowerCase());
        if (matchesMine) {
          totalOutflowTons += cleanNum(ci.weight);
          dispatchUsedMine = true;
        }
      }
    }
    if (dispatchUsedMine) {
      linkedDispatchesCount++;
    }
  }

  const remainingTons = Math.round((totalInflowTons - totalOutflowTons) * 100) / 100;
  const isOverdrawn = remainingTons < -0.001;
  const remainingValue = Math.round(Math.max(0, remainingTons) * cleanNum(mine.ratePerTon));
  const totalOutflowValue = Math.round(totalOutflowTons * cleanNum(mine.ratePerTon));

  let status: 'in_stock' | 'low' | 'exhausted' | 'overdrawn' = 'in_stock';
  if (isOverdrawn) {
    status = 'overdrawn';
  } else if (remainingTons <= 0) {
    status = 'exhausted';
  } else if (remainingTons < 20) {
    status = 'low';
  }

  return {
    mine,
    totalInflowTons: Math.round(totalInflowTons * 100) / 100,
    totalInflowValue: Math.round(totalInflowValue),
    totalOutflowTons: Math.round(totalOutflowTons * 100) / 100,
    totalOutflowValue,
    remainingTons,
    remainingValue,
    isOverdrawn,
    entriesCount: activeLots.length,
    dispatchesCount: linkedDispatchesCount,
    status,
  };
}

/**
 * Aggregates overall stock metrics across all active mines
 */
export function calculateOverallMinesSummary(
  mines: Mine[],
  lots: InventoryLot[],
  dispatches: Dispatch[]
) {
  const activeMines = (mines || []).filter((m) => !m.deleted);
  let totalYardTons = 0;
  let totalYardValue = 0;
  let totalInflowTons = 0;
  let totalOutflowTons = 0;
  let overdrawnCount = 0;

  for (const mine of activeMines) {
    const summary = calculateMineStock(mine, lots, dispatches);
    totalYardTons += summary.remainingTons;
    totalYardValue += summary.remainingValue;
    totalInflowTons += summary.totalInflowTons;
    totalOutflowTons += summary.totalOutflowTons;
    if (summary.isOverdrawn) overdrawnCount++;
  }

  return {
    totalMines: activeMines.length,
    totalYardTons: Math.round(totalYardTons * 100) / 100,
    totalYardValue: Math.round(totalYardValue),
    totalInflowTons: Math.round(totalInflowTons * 100) / 100,
    totalOutflowTons: Math.round(totalOutflowTons * 100) / 100,
    overdrawnCount,
  };
}



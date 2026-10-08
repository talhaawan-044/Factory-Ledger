import { describe, it, expect } from 'vitest';
import { calculateSettlement, calculatePartyBalance, calculateTransitLoss } from '../src/utils/calculations';
import type { Dispatch, Payment } from '../src/types';

describe('T1: Settlement and Financial Calculations Golden Values', () => {
  it('matches hand-calculated golden settlement values with 18% sales tax and 5% income tax formula', () => {
    // Scenario from ISSUES_AND_FIXES.md Section 6:
    // loaded 20 t @ 30,000 plus 10 t @ 28,000
    // overheads: loading 3,000 + freight 90,000 + crush 5,000 + royalty 4,000 + other 0 = 102,000
    // base rate: 38,000; manual deduction: 500; commission: 200; received weight: 29.4 t;
    // tax formula: 18% sales / 5% income
    const dispatch: Dispatch = {
      id: 'disp-golden-1',
      date: '2026-10-08',
      partyId: 'party-1',
      truckNumber: 'TK-1234',
      factoryName: 'Test Factory',
      targetGcv: 6000,
      labActualGcv: 6000,
      labSulphur: 1,
      coalInputs: [
        { id: 'c1', sourceName: 'Mine A', weight: 20, purchaseRate: 30000 },
        { id: 'c2', sourceName: 'Mine B', weight: 10, purchaseRate: 28000 },
      ],
      overheads: {
        loading: 3000,
        freight: 90000,
        crush: 5000,
        royalty: 4000,
        other: 0,
      },
      baseRate: 38000,
      manualDeduction: 500,
      manualPremium: 0,
      taxMethod: 'formula_18_5',
      taxSalesPercent: 18,
      taxIncomePercent: 5,
      commissionPerTon: 200,
      labReceivedWeight: 29.4,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = calculateSettlement(dispatch);

    // Adjusted rate: 38,000 - 500 = 37,500
    expect(result.adjustedRate).toBe(37500);

    // Tax deduction: 37,500 * 1.18 * 0.05 = 2,212.5
    expect(result.taxDeduction).toBeCloseTo(2212.5, 4);

    // Payable rate: 37,500 - 2,212.5 - 200 = 35,087.5
    expect(result.payableRate).toBeCloseTo(35087.5, 4);

    // Total revenue: 35,087.5 * 29.4 = 1,031,572.5
    expect(result.totalRevenue).toBeCloseTo(1031572.5, 2);

    // Total cost: (20 * 30,000 + 10 * 28,000) + 102,000 = 600,000 + 280,000 + 102,000 = 982,000
    expect(result.totalCost).toBe(982000);

    // Net profit: 1,031,572.5 - 982,000 = 49,572.5
    expect(result.netProfit).toBeCloseTo(49572.5, 2);
  });

  it('calculates party balance accurately with dispatches and payments', () => {
    const dispatch: Dispatch = {
      id: 'disp-1',
      date: '2026-10-08',
      partyId: 'party-1',
      truckNumber: 'TK-1234',
      factoryName: 'Test Factory',
      targetGcv: 6000,
      labActualGcv: 6000,
      labSulphur: 1,
      coalInputs: [{ id: 'c1', sourceName: 'Mine A', weight: 10, purchaseRate: 20000 }],
      overheads: { loading: 0, freight: 0, crush: 0, royalty: 0, other: 0 },
      baseRate: 30000,
      manualDeduction: 0,
      manualPremium: 0,
      manualTax: 0,
      taxMethod: 'manual',
      commissionPerTon: 0,
      labReceivedWeight: 10,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const payments: Payment[] = [
      {
        id: 'pay-1',
        partyId: 'party-1',
        amount: 200000,
        type: 'received',
        date: '2026-10-08',
        mode: 'bank',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'pay-2',
        partyId: 'party-1',
        amount: 50000,
        type: 'paid',
        date: '2026-10-08',
        mode: 'cash',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const balance = calculatePartyBalance([dispatch], payments);

    // Total billed: 30,000 * 10 = 300,000
    expect(balance.totalBilled).toBe(300000);
    // Net payments received: 200,000 (received) - 50,000 (paid) = 150,000
    expect(balance.totalPaymentsReceived).toBe(200000);
    expect(balance.totalPaymentsPaid).toBe(50000);
    expect(balance.netPaymentsReceived).toBe(150000);
    // Outstanding balance: 300,000 - 150,000 = 150,000 receivable
    expect(balance.outstandingBalance).toBe(150000);
    expect(balance.isReceivable).toBe(true);
    expect(balance.isAdvance).toBe(false);
  });

  it('calculates transit loss and percentage correctly', () => {
    const dispatch: Dispatch = {
      id: 'disp-loss',
      date: '2026-10-08',
      partyId: 'party-1',
      truckNumber: 'TK-1234',
      factoryName: 'Test Factory',
      targetGcv: 6000,
      labActualGcv: 6000,
      labSulphur: 1,
      coalInputs: [{ id: 'c1', sourceName: 'Mine A', weight: 30, purchaseRate: 20000 }],
      overheads: { loading: 0, freight: 0, crush: 0, royalty: 0, other: 0 },
      baseRate: 30000,
      manualDeduction: 0,
      manualPremium: 0,
      manualTax: 0,
      taxMethod: 'manual',
      commissionPerTon: 0,
      labReceivedWeight: 29.4,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const loss = calculateTransitLoss(dispatch);
    expect(loss.totalLoadedWeight).toBe(30);
    expect(loss.receivedWeight).toBe(29.4);
    expect(loss.diff).toBeCloseTo(-0.6, 2);
    expect(loss.isLoss).toBe(true);
    expect(loss.isGain).toBe(false);
    expect(loss.lossPercentage).toBeCloseTo(2, 2); // 0.6 / 30 = 2%
  });
});

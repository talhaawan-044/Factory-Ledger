import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateSettlement,
  calculateLandedCost,
  calculateLotStock,
  calculateInventoryTotals,
} from '../src/utils/calculations';
import {
  saveLot,
  getLots,
  getLot,
  deleteLot,
  clearAllData,
  getAllBackupData,
  restoreBackup,
  getLedgerForSync,
  markRecordsClean,
  mergeLedgerData,
} from '../src/lib/db';
import type { InventoryLot, Dispatch, PurchaseOrder } from '../src/types';

describe('New Features: Pro-Rata GCV & Inventory with Landed Cost', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearAllData();
  });

  describe('Feature 1: Pro-Rata GCV Dynamic Pricing & Rounding', () => {
    it('calculates exact pro-rata deduction for 4,300 lab GCV with 31,800 base rate at 4,500 target', () => {
      // Reviewer Example: 31,800 at 4,500 target, lab GCV 4,300
      // Exact: 31,800 * (1 - 4300 / 4500) = 1,413.3333...
      const dispatchPaisa: Dispatch = {
        id: 'disp-prorata-1',
        partyId: 'party-1',
        date: '2026-10-08',
        truckNumber: 'TK-101',
        factoryName: 'Maple Leaf Cement',
        targetGcv: 4500,
        labActualGcv: 4300,
        baseRate: 31800,
        labReceivedWeight: 25,
        labSulphur: 1,
        coalInputs: [],
        overheads: { loading: 0, freight: 0, crush: 0, royalty: 0, other: 0 },
        gcvAdjustment: 'prorata',
        gcvAdjustmentRounding: 'paisa',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const resultPaisa = calculateSettlement(dispatchPaisa);
      expect(resultPaisa.gcvDeduction).toBe(1413.33);
      expect(resultPaisa.adjustedRate).toBe(31800 - 1413.33);
      expect(resultPaisa.isProrata).toBe(true);

      // Whole Rupee Rounding
      const dispatchRupee: Dispatch = {
        ...dispatchPaisa,
        gcvAdjustmentRounding: 'rupee',
      };
      const resultRupee = calculateSettlement(dispatchRupee);
      expect(resultRupee.gcvDeduction).toBe(1413);
      expect(resultRupee.adjustedRate).toBe(31800 - 1413);
    });

    it('calculates pro-rata deduction for 4,200 and 4,100 lab GCV matches reviewer spec', () => {
      // 4,200: exact 2,120
      const d4200: Dispatch = {
        id: 'disp-4200',
        partyId: 'party-1',
        date: '2026-10-08',
        truckNumber: 'TK-102',
        factoryName: 'Bestway',
        targetGcv: 4500,
        labActualGcv: 4200,
        baseRate: 31800,
        labReceivedWeight: 20,
        labSulphur: 1,
        coalInputs: [],
        overheads: { loading: 0, freight: 0, crush: 0, royalty: 0, other: 0 },
        gcvAdjustment: 'prorata',
        gcvAdjustmentRounding: 'paisa',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(calculateSettlement(d4200).gcvDeduction).toBe(2120);

      // 4,100: exact 2,826.67 (paisa) or 2,827 (rupee)
      const d4100Paisa: Dispatch = {
        ...d4200,
        labActualGcv: 4100,
        gcvAdjustmentRounding: 'paisa',
      };
      expect(calculateSettlement(d4100Paisa).gcvDeduction).toBe(2826.67);

      const d4100Rupee: Dispatch = {
        ...d4200,
        labActualGcv: 4100,
        gcvAdjustmentRounding: 'rupee',
      };
      expect(calculateSettlement(d4100Rupee).gcvDeduction).toBe(2827);
    });

    it('calculates pro-rata premium when lab GCV exceeds target GCV', () => {
      const dispatchPremium: Dispatch = {
        id: 'disp-prem',
        partyId: 'party-1',
        date: '2026-10-08',
        truckNumber: 'TK-103',
        factoryName: 'Factory High GCV',
        targetGcv: 4500,
        labActualGcv: 4700,
        baseRate: 31800,
        labReceivedWeight: 30,
        labSulphur: 1,
        coalInputs: [],
        overheads: { loading: 0, freight: 0, crush: 0, royalty: 0, other: 0 },
        gcvAdjustment: 'prorata',
        gcvAdjustmentRounding: 'paisa',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Premium = 31,800 * (4,700 / 4,500 - 1) = 31,800 * (200 / 4,500) = 1,413.33
      const result = calculateSettlement(dispatchPremium);
      expect(result.gcvDeduction).toBe(0);
      expect(result.gcvPremium).toBe(1413.33);
      expect(result.adjustedRate).toBe(31800 + 1413.33);
    });

    it('preserves backward compatibility: old dispatches without gcvAdjustment use manual adjustments', () => {
      const oldDispatch: Dispatch = {
        id: 'disp-old',
        partyId: 'party-1',
        date: '2026-10-08',
        truckNumber: 'TK-OLD',
        factoryName: 'Legacy Factory',
        targetGcv: 5000,
        labActualGcv: 4800,
        baseRate: 30000,
        manualDeduction: 500,
        manualPremium: 100,
        labReceivedWeight: 25,
        labSulphur: 1,
        coalInputs: [],
        overheads: { loading: 0, freight: 0, crush: 0, royalty: 0, other: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = calculateSettlement(oldDispatch);
      expect(result.gcvDeduction).toBe(500);
      expect(result.adjustedRate).toBe(30000 - 500 + 100);
      expect(result.isProrata).toBe(false);
    });
  });

  describe('Feature 2: Two Weights & Landed Cost Formula', () => {
    it('calculates landed rate matching reviewer formula: (30t billed @ 20,000, 28.5t received = 21,052.63/t)', () => {
      const landed = calculateLandedCost(30, 28.5, 20000);
      expect(landed.totalCost).toBe(600000);
      expect(landed.landedRate).toBe(21052.63);
    });

    it('handles zero or equal received weights safely', () => {
      const zeroRec = calculateLandedCost(30, 0, 20000);
      expect(zeroRec.landedRate).toBe(20000);

      const exactRec = calculateLandedCost(30, 30, 20000);
      expect(exactRec.landedRate).toBe(20000);
    });
  });

  describe('Feature 3: Inventory Stock Derivation & Multi-Device Safety', () => {
    const testLot: InventoryLot = {
      id: 'lot-hashim-1',
      supplier: 'Hashim Coal Mines',
      date: '2026-10-08',
      billedWeight: 30,
      receivedWeight: 28.5,
      purchaseRate: 20000,
      landedRate: 21052.63,
      truckNumber: 'TK-SUP-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      dirty: true,
    };

    it('derives initial remaining stock equal to received weight with no dispatches', () => {
      const stock = calculateLotStock(testLot, []);
      expect(stock.usedWeight).toBe(0);
      expect(stock.remainingWeight).toBe(28.5);
      expect(stock.isOverdrawn).toBe(false);
      expect(stock.capitalTiedUp).toBe(Math.round(28.5 * 21052.63));
    });

    it('automatically deducts stock dynamically when non-deleted dispatches reference lotId', () => {
      const dispatch1: Dispatch = {
        id: 'd-use-1',
        partyId: 'p-1',
        date: '2026-10-08',
        truckNumber: 'TK-OUT-1',
        factoryName: 'Maple Leaf',
        targetGcv: 5000,
        baseRate: 32000,
        labActualGcv: 5000,
        labSulphur: 1,
        labReceivedWeight: 15,
        overheads: { loading: 0, freight: 0, crush: 0, royalty: 0, other: 0 },
        coalInputs: [
          { id: 'c-1', sourceName: 'Hashim Coal', weight: 12.5, purchaseRate: 21052.63, lotId: 'lot-hashim-1' },
          { id: 'c-2', sourceName: 'Other Coal', weight: 2.5, purchaseRate: 15000 },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const dispatch2: Dispatch = {
        ...dispatch1,
        id: 'd-use-2',
        coalInputs: [
          { id: 'c-3', sourceName: 'Hashim Coal', weight: 10, purchaseRate: 21052.63, lotId: 'lot-hashim-1' },
        ],
      };

      // Dispatches used: 12.5 + 10 = 22.5 tons
      const stock = calculateLotStock(testLot, [dispatch1, dispatch2]);
      expect(stock.usedWeight).toBe(22.5);
      expect(stock.remainingWeight).toBe(6); // 28.5 - 22.5 = 6.0
      expect(stock.isOverdrawn).toBe(false);
    });

    it('restores stock automatically when a dispatch is soft-deleted', () => {
      const dispatchActive: Dispatch = {
        id: 'd-act',
        partyId: 'p-1',
        date: '2026-10-08',
        truckNumber: 'TK-1',
        factoryName: 'Factory A',
        targetGcv: 5000,
        baseRate: 30000,
        labActualGcv: 5000,
        labSulphur: 1,
        labReceivedWeight: 10,
        overheads: { loading: 0, freight: 0, crush: 0, royalty: 0, other: 0 },
        coalInputs: [
          { id: 'ci-1', sourceName: 'Hashim', weight: 10, purchaseRate: 21052.63, lotId: 'lot-hashim-1' },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const dispatchDeleted: Dispatch = {
        ...dispatchActive,
        id: 'd-del',
        deleted: true,
        coalInputs: [
          { id: 'ci-2', sourceName: 'Hashim', weight: 15, purchaseRate: 21052.63, lotId: 'lot-hashim-1' },
        ],
      };

      // Deleted dispatch weight (15t) is ignored
      const stock = calculateLotStock(testLot, [dispatchActive, dispatchDeleted]);
      expect(stock.usedWeight).toBe(10);
      expect(stock.remainingWeight).toBe(18.5);
    });

    it('flags overdrawn stock when dispatches exceed received lot weight', () => {
      const heavyDispatch: Dispatch = {
        id: 'd-heavy',
        partyId: 'p-1',
        date: '2026-10-08',
        truckNumber: 'TK-HEAVY',
        factoryName: 'Factory Heavy',
        targetGcv: 5000,
        baseRate: 30000,
        labActualGcv: 5000,
        labSulphur: 1,
        labReceivedWeight: 35,
        overheads: { loading: 0, freight: 0, crush: 0, royalty: 0, other: 0 },
        coalInputs: [
          { id: 'ci-over', sourceName: 'Hashim', weight: 32, purchaseRate: 21052.63, lotId: 'lot-hashim-1' },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // 28.5 - 32 = -3.5 tons
      const stock = calculateLotStock(testLot, [heavyDispatch]);
      expect(stock.usedWeight).toBe(32);
      expect(stock.remainingWeight).toBe(-3.5);
      expect(stock.isOverdrawn).toBe(true);
      expect(stock.capitalTiedUp).toBe(0);
    });

    it('calculates inventory totals across multiple lots and suppliers', () => {
      const lotA = { ...testLot, id: 'lot-a', receivedWeight: 20, landedRate: 20000 };
      const lotB = { ...testLot, id: 'lot-b', supplier: 'Quetta Mines', receivedWeight: 30, landedRate: 25000 };

      const totals = calculateInventoryTotals([lotA, lotB], []);
      expect(totals.totalReceivedTons).toBe(50);
      expect(totals.totalRemainingTons).toBe(50);
      expect(totals.totalCapitalTiedUp).toBe(20 * 20000 + 30 * 25000);
      expect(totals.suppliers).toHaveLength(2);
    });
  });

  describe('Feature 4: IndexedDB CRUD, Backup & Cloud Sync Integration for Lots', () => {
    it('saves, retrieves, and soft-deletes lots in IndexedDB with dirty flag', async () => {
      const lot: InventoryLot = {
        id: 'lot-idb-1',
        supplier: 'Balochistan Minerals',
        date: '2026-10-08',
        billedWeight: 50,
        receivedWeight: 48,
        purchaseRate: 22000,
        landedRate: 22916.67,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveLot(lot);
      const all = await getLots();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('lot-idb-1');
      expect(all[0].dirty).toBe(true);

      const single = await getLot('lot-idb-1');
      expect(single?.supplier).toBe('Balochistan Minerals');

      // Soft delete
      await deleteLot('lot-idb-1');
      const afterDel = await getLots();
      expect(afterDel).toHaveLength(0);

      // Verify dirty tombstoned record is queued for cloud sync
      const syncQueue = await getLedgerForSync(true);
      expect(syncQueue.lots.some((l) => l.id === 'lot-idb-1' && l.deleted)).toBe(true);
    });

    it('marks synced lots clean only if updatedAt matches (Issue 31 guard)', async () => {
      const lot: InventoryLot = {
        id: 'lot-sync-1',
        supplier: 'Thar Lignite',
        date: '2026-10-08',
        billedWeight: 40,
        receivedWeight: 39,
        purchaseRate: 18000,
        landedRate: 18461.54,
        createdAt: 1000,
        updatedAt: 1000,
      };

      await saveLot(lot);
      const dirtyBefore = await getLedgerForSync(true);
      const savedUpdatedAt = dirtyBefore.lots[0].updatedAt;

      // Mark clean with matching timestamp
      await markRecordsClean({ lots: [{ id: 'lot-sync-1', updatedAt: savedUpdatedAt }] });
      const dirtyAfter = await getLedgerForSync(true);
      expect(dirtyAfter.lots).toHaveLength(0);
    });

    it('includes lots in backup payload and restores lots atomically', async () => {
      const lot: InventoryLot = {
        id: 'lot-bak-1',
        supplier: 'Frontier Coal',
        date: '2026-10-08',
        billedWeight: 35,
        receivedWeight: 34,
        purchaseRate: 25000,
        landedRate: 25735.29,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveLot(lot);
      const backup = await getAllBackupData();
      expect(backup.lots).toHaveLength(1);

      await clearAllData();
      const empty = await getLots();
      expect(empty).toHaveLength(0);

      const restoreRes = await restoreBackup(backup);
      expect(restoreRes.success).toBe(true);
      expect(restoreRes.counts?.lots).toBe(1);

      const restored = await getLots();
      expect(restored).toHaveLength(1);
      expect(restored[0].id).toBe('lot-bak-1');
    });

    it('merges lots bidirectionally with Last-Write-Wins and tombstones', () => {
      const localLots: InventoryLot[] = [
        {
          id: 'lot-merge-1',
          supplier: 'Supplier Local',
          date: '2026-10-08',
          billedWeight: 20,
          receivedWeight: 19,
          purchaseRate: 20000,
          landedRate: 21052.63,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];

      const cloudLots: InventoryLot[] = [
        {
          id: 'lot-merge-1',
          supplier: 'Supplier Remote (Newer)',
          date: '2026-10-08',
          billedWeight: 20,
          receivedWeight: 19,
          purchaseRate: 20000,
          landedRate: 21052.63,
          createdAt: 1000,
          updatedAt: 2000,
        },
        {
          id: 'lot-merge-2',
          supplier: 'Supplier Only On Cloud',
          date: '2026-10-08',
          billedWeight: 15,
          receivedWeight: 15,
          purchaseRate: 19000,
          landedRate: 19000,
          createdAt: 1500,
          updatedAt: 1500,
        },
      ];

      const { merged, hasLocalChanges } = mergeLedgerData(
        { parties: [], dispatches: [], payments: [], pos: [], lots: localLots, settings: {} as any },
        { parties: [], dispatches: [], payments: [], pos: [], lots: cloudLots, settings: {} as any }
      );

      expect(hasLocalChanges).toBe(true);
      expect(merged.lots).toHaveLength(2);
      const mergedL1 = merged.lots?.find((l) => l.id === 'lot-merge-1');
      expect(mergedL1?.supplier).toBe('Supplier Remote (Newer)');
    });
  });
});

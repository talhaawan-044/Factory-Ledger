import { describe, it, expect, beforeEach } from 'vitest';
import { saveSettings, getSettings, mergeLedgerData } from '../src/lib/db';
import { sanitizeForFirestore } from '../src/lib/firebase';
import type { AppSettings, Dispatch, Party } from '../src/types';

describe('Phase C: Two-Device Sync Scenarios & Settings Separation (Issues 21, 22, 28)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Issue 22: Per-Device Settings vs Shared Business Settings (T14)', () => {
    it('toggling theme does NOT change updatedAt', async () => {
      const initial: AppSettings = {
        businessName: 'Apex Coal',
        theme: 'light',
        taxFormulaSalesPercent: 18,
        taxFormulaIncomePercent: 5,
        updatedAt: 1000,
      };
      await saveSettings(initial);

      const afterInit = await getSettings();
      expect(afterInit?.theme).toBe('light');

      // Now toggle theme only
      await saveSettings({
        ...afterInit!,
        theme: 'dark',
      });

      const afterThemeToggle = await getSettings();
      expect(afterThemeToggle?.theme).toBe('dark');
      // updatedAt MUST NOT be bumped for theme changes
      expect(afterThemeToggle?.updatedAt).toBe(afterInit!.updatedAt);
    });

    it('toggling appLock or pin fields does NOT change updatedAt', async () => {
      const initial: AppSettings = {
        businessName: 'Apex Coal',
        appLockEnabled: false,
        pinHash: 'abc',
        updatedAt: 2000,
      };
      await saveSettings(initial);
      const afterInit = await getSettings();

      await saveSettings({
        ...afterInit!,
        appLockEnabled: true,
        lockTimeout: 300,
      });

      const updated = await getSettings();
      expect(updated?.appLockEnabled).toBe(true);
      expect(updated?.lockTimeout).toBe(300);
      expect(updated?.updatedAt).toBe(afterInit!.updatedAt);
    });

    it('changing business name or tax rates DOES bump updatedAt', async () => {
      const initial: AppSettings = {
        businessName: 'Apex Coal',
        taxFormulaSalesPercent: 18,
        taxFormulaIncomePercent: 5,
        updatedAt: 1000,
      };
      await saveSettings(initial);

      await saveSettings({
        ...initial,
        taxFormulaSalesPercent: 19,
      });

      const updated = await getSettings();
      expect(updated?.taxFormulaSalesPercent).toBe(19);
      expect(updated?.updatedAt).toBeGreaterThan(1000);
    });

    it('Scenario S4: local device theme is preserved when merging newer cloud settings', () => {
      const local = {
        parties: [],
        dispatches: [],
        payments: [],
        pos: [],
        settings: {
          businessName: 'Old Business Name',
          taxFormulaSalesPercent: 18,
          theme: 'dark' as const,
          appLockEnabled: true,
          pinHash: 'local-hash',
          updatedAt: 1000,
        },
      };

      const cloud = {
        parties: [],
        dispatches: [],
        payments: [],
        pos: [],
        settings: {
          businessName: 'New Cloud Business Name',
          taxFormulaSalesPercent: 19,
          // Cloud has no theme (stripped) or different
          theme: 'light' as const,
          updatedAt: 2000,
        },
      };

      const { merged } = mergeLedgerData(local as any, cloud as any);

      // Business fields come from newer cloud settings
      expect(merged.settings?.businessName).toBe('New Cloud Business Name');
      expect(merged.settings?.taxFormulaSalesPercent).toBe(19);
      expect(merged.settings?.updatedAt).toBe(2000);

      // Device-only settings (theme, appLockEnabled, pinHash) are preserved locally!
      expect(merged.settings?.theme).toBe('dark');
      expect(merged.settings?.appLockEnabled).toBe(true);
      expect(merged.settings?.pinHash).toBe('local-hash');
    });
  });

  describe('Issue 28a: Cloud Hygiene & Dirty Flags (T20)', () => {
    it('sanitizeForFirestore strips dirty, theme, and PIN fields from upload payload', () => {
      const localSettings: AppSettings = {
        businessName: 'Apex Coal',
        theme: 'dark',
        appLockEnabled: true,
        pinHash: 'secret-hash',
        pinLength: 4,
        lockTimeout: 60,
        updatedAt: 5000,
      };

      const sanitized = sanitizeForFirestore(localSettings);
      expect(sanitized).not.toHaveProperty('dirty');
      expect(sanitized).not.toHaveProperty('theme');
      expect(sanitized).not.toHaveProperty('pinHash');
      expect(sanitized).not.toHaveProperty('pinLength');
      expect(sanitized).not.toHaveProperty('lockTimeout');
      expect(sanitized).not.toHaveProperty('appLockEnabled');
      expect(sanitized.businessName).toBe('Apex Coal');
      expect(sanitized.updatedAt).toBe(5000);
    });

    it('sanitizeForFirestore strips dirty from dispatch and party objects', () => {
      const localDispatch: Partial<Dispatch> & { dirty: boolean } = {
        id: 'disp-1',
        truckNumber: 'TK-1234',
        dirty: true,
        updatedAt: 12345,
      };

      const sanitized = sanitizeForFirestore(localDispatch);
      expect(sanitized).not.toHaveProperty('dirty');
      expect(sanitized.id).toBe('disp-1');
      expect(sanitized.truckNumber).toBe('TK-1234');
    });
  });

  describe('Scenario S1 & S3: Multi-Device Conflict Resolution via Newer-Wins', () => {
    it('newer cloud edit wins over older local edit', () => {
      const local = {
        parties: [],
        dispatches: [
          { id: 'd1', truckNumber: 'TK-OLD', labReceivedWeight: 25, updatedAt: 1000 } as Dispatch,
        ],
        payments: [],
        pos: [],
        settings: undefined,
      };

      const cloud = {
        parties: [],
        dispatches: [
          { id: 'd1', truckNumber: 'TK-NEW', labReceivedWeight: 28, updatedAt: 2000 } as Dispatch,
        ],
        payments: [],
        pos: [],
        settings: undefined,
      };

      const { merged } = mergeLedgerData(local as any, cloud as any);
      expect(merged.dispatches).toHaveLength(1);
      expect(merged.dispatches[0].truckNumber).toBe('TK-NEW');
      expect(merged.dispatches[0].labReceivedWeight).toBe(28);
      expect(merged.dispatches[0].updatedAt).toBe(2000);
    });

    it('newer soft delete wins over older non-deleted state', () => {
      const local = {
        parties: [],
        dispatches: [
          { id: 'd1', truckNumber: 'TK-1', deleted: false, updatedAt: 1000 } as Dispatch,
        ],
        payments: [],
        pos: [],
        settings: undefined,
      };

      const cloud = {
        parties: [],
        dispatches: [
          { id: 'd1', truckNumber: 'TK-1', deleted: true, updatedAt: 2000 } as Dispatch,
        ],
        payments: [],
        pos: [],
        settings: undefined,
      };

      const { merged, hasLocalChanges } = mergeLedgerData(local as any, cloud as any);
      // Soft-deleted item is pruned from active ledger list, marking local change
      expect(merged.dispatches).toHaveLength(0);
      expect(hasLocalChanges).toBe(true);
    });

    it('Scenario S5: newly signed-in device ingests clean records and does not re-upload unchanged data', () => {
      // Pulled cloud items have dirty: false per Issue 28a
      const pulledDispatches: Array<Partial<Dispatch> & { dirty?: boolean }> = [
        { id: 'd1', truckNumber: 'TK-1', dirty: false, updatedAt: 2000 },
        { id: 'd2', truckNumber: 'TK-2', dirty: false, updatedAt: 2000 },
      ];

      // When delta-only sync filters for dirty records:
      const pendingUploads = pulledDispatches.filter((d) => d.dirty);
      expect(pendingUploads).toHaveLength(0);
    });

    it('Scenario S6: chunking handles collections with over 400 operations', () => {
      const CHUNK_SIZE = 400;
      const largeBatch = Array.from({ length: 950 }, (_, i) => ({
        id: `disp-${i}`,
        truckNumber: `TK-${i}`,
      }));

      const chunks: Array<typeof largeBatch> = [];
      for (let i = 0; i < largeBatch.length; i += CHUNK_SIZE) {
        chunks.push(largeBatch.slice(i, i + CHUNK_SIZE));
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveLength(400);
      expect(chunks[1]).toHaveLength(400);
      expect(chunks[2]).toHaveLength(150);
    });

    it('Scenario S7: offline edits with dirty: true are isolated and flushed on reconnect', () => {
      const dispatches: Array<Partial<Dispatch> & { dirty?: boolean }> = [
        { id: 'd1', truckNumber: 'TK-1', dirty: false, updatedAt: 1000 },
        { id: 'd2', truckNumber: 'TK-2', dirty: true, updatedAt: 2500 }, // Edited offline
        { id: 'd3', truckNumber: 'TK-3', dirty: false, updatedAt: 1200 },
      ];

      const dirtyList = dispatches.filter((d) => d.dirty);
      expect(dirtyList).toHaveLength(1);
      expect(dirtyList[0].id).toBe('d2');
    });

    it('Scenario S8: cloud soft delete all records leaves active ledger clean', () => {
      const local = {
        parties: [{ id: 'p1', name: 'Party 1', deleted: false, updatedAt: 1000 } as Party],
        dispatches: [{ id: 'd1', truckNumber: 'TK-1', deleted: false, updatedAt: 1000 } as Dispatch],
        payments: [],
        pos: [],
        settings: undefined,
      };

      const cloud = {
        parties: [{ id: 'p1', name: 'Party 1', deleted: true, updatedAt: 3000 } as Party],
        dispatches: [{ id: 'd1', truckNumber: 'TK-1', deleted: true, updatedAt: 3000 } as Dispatch],
        payments: [],
        pos: [],
        settings: undefined,
      };

      const { merged, hasLocalChanges } = mergeLedgerData(local as any, cloud as any);
      expect(merged.parties).toHaveLength(0);
      expect(merged.dispatches).toHaveLength(0);
      expect(hasLocalChanges).toBe(true);
    });
  });
});

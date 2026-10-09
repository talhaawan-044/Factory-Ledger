import Dexie, { type Table } from 'dexie';
import type { Dispatch, Party, Payment, PurchaseOrder, InventoryLot, Mine } from '../types';

export interface ImageRecord {
  key: string;
  dataUrl: string;
  updatedAt: number;
}

export interface MetaRecord {
  key: string;
  value: any;
  updatedAt: number;
}

export class FactoryLedgerDB extends Dexie {
  parties!: Table<Party, string>;
  dispatches!: Table<Dispatch, string>;
  payments!: Table<Payment, string>;
  pos!: Table<PurchaseOrder, string>;
  mines!: Table<Mine, string>;
  lots!: Table<InventoryLot, string>;
  images!: Table<ImageRecord, string>;
  meta!: Table<MetaRecord, string>;

  constructor() {
    super('FactoryLedgerDB');
    this.version(1).stores({
      parties: 'id, name, updatedAt, isArchived, deleted',
      dispatches: 'id, partyId, date, updatedAt, dirty, deleted',
      payments: 'id, partyId, date, updatedAt, dirty, deleted',
      pos: 'id, partyId, updatedAt, dirty, deleted',
      images: 'key',
      meta: 'key',
    });
    this.version(2).stores({
      lots: 'id, supplier, date, updatedAt, dirty, deleted',
    });
    this.version(3).stores({
      mines: 'id, name, updatedAt, dirty, deleted',
      lots: 'id, mineId, supplier, date, updatedAt, dirty, deleted',
    });
  }
}

export const idb = new FactoryLedgerDB();

// Persistent-storage permission is an optional resilience enhancement. It must
// never prevent the ledger itself from opening if a browser or WebView leaves
// the permission request pending.
const PERSISTENCE_REQUEST_TIMEOUT_MS = 3_000;

/**
 * Request persistent browser/device storage to prevent eviction under OS disk pressure.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const persistenceRequest = navigator.storage.persist();
      const timeout = new Promise<boolean>((resolve) => {
        timeoutId = setTimeout(() => resolve(false), PERSISTENCE_REQUEST_TIMEOUT_MS);
      });
      const persisted = await Promise.race([persistenceRequest, timeout]);
      console.log(`[Storage] Persistent storage granted: ${persisted}`);
      return persisted;
    } catch (err) {
      console.warn('[Storage] Could not request persistent storage:', err);
      return false;
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  }
  return false;
}

import Dexie, { type Table } from 'dexie';
import type { Dispatch, Party, Payment, PurchaseOrder } from '../types';

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
  }
}

export const idb = new FactoryLedgerDB();

/**
 * Request persistent browser/device storage to prevent eviction under OS disk pressure.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const persisted = await navigator.storage.persist();
      console.log(`[Storage] Persistent storage granted: ${persisted}`);
      return persisted;
    } catch (err) {
      console.warn('[Storage] Could not request persistent storage:', err);
      return false;
    }
  }
  return false;
}

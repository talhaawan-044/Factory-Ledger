import type { Dispatch, Party, AppSettings, Payment, PurchaseOrder } from "../types";

const DISPATCHES_KEY = "dispatches";
const PARTIES_KEY = "parties";
const PAYMENTS_KEY = "payments";
const SETTINGS_KEY = "app_settings";
const POS_KEY = "purchase_orders";

// Initial empty datasets for production
export const INITIAL_PARTIES: Party[] = [];
export const INITIAL_POS: PurchaseOrder[] = [];
export const INITIAL_DISPATCHES: Dispatch[] = [];
export const INITIAL_PAYMENTS: Payment[] = [];

export const INITIAL_SETTINGS: AppSettings = {
  userName: "",
  businessName: "",
  phoneNumber: "",
  logoUrl: "",
  signatureUrl: "",
  theme: "light",
  currency: "PKR (Rs.)",
  numberFormat: "million",
  defaultTaxMethod: "formula_18_5",
  taxFormulaSalesPercent: 18,
  taxFormulaIncomePercent: 5,
  accountType: "Commercial Coal Trader",
  companyAddress: "",
  ntnNumber: "",
  appLockEnabled: false,
  pinHash: "",
  pinLength: 5,
  lockTimeout: 0,
};

const DATA_VERSION_KEY = "coal_ledger_version";
const CURRENT_DATA_VERSION = "2026.10_clean_production_v2";
const TOMBSTONES_KEY = "ledger_tombstones";

export type LedgerEntityType = 'dispatch' | 'party' | 'payment' | 'purchase_order' | 'settings' | 'all';
export type LedgerMutationAction = 'create' | 'update' | 'delete' | 'restore';

export interface LedgerMutationDetail {
  entityType: LedgerEntityType;
  id?: string;
  action: LedgerMutationAction;
  timestamp: number;
}

/**
 * Broadcast local ledger changes to active views and background sync manager
 */
export function notifyLedgerMutation(
  entityType: LedgerEntityType,
  id?: string,
  action: LedgerMutationAction = 'update'
) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<LedgerMutationDetail>('ledger_data_changed', {
        detail: {
          entityType,
          id,
          action,
          timestamp: Date.now(),
        },
      })
    );
  }
}

/**
 * Retrieve deletion tombstones to prevent remote cloud syncs from re-introducing deleted items
 */
export function getTombstones(): Record<string, number> {
  try {
    const raw = localStorage.getItem(TOMBSTONES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Record a deleted entity ID with timestamp and prune tombstones older than 60 days
 */
export function recordTombstone(id: string): void {
  try {
    const tombstones = getTombstones();
    tombstones[id] = Date.now();
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
    for (const k in tombstones) {
      if (tombstones[k] < cutoff) {
        delete tombstones[k];
      }
    }
    localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(tombstones));
  } catch (err) {
    console.warn('Failed to record deletion tombstone:', err);
  }
}

const OWNER_UID_KEY = "coal_ledger_owner_uid";
const OWNER_EMAIL_KEY = "coal_ledger_owner_email";

export interface LedgerOwnerInfo {
  uid: string | null;
  email: string | null;
}

export function getLedgerOwner(): LedgerOwnerInfo {
  try {
    return {
      uid: localStorage.getItem(OWNER_UID_KEY),
      email: localStorage.getItem(OWNER_EMAIL_KEY),
    };
  } catch {
    return { uid: null, email: null };
  }
}

export function setLedgerOwner(uid: string | null, email: string | null): void {
  try {
    if (uid) {
      localStorage.setItem(OWNER_UID_KEY, uid);
    } else {
      localStorage.removeItem(OWNER_UID_KEY);
    }
    if (email) {
      localStorage.setItem(OWNER_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(OWNER_EMAIL_KEY);
    }
  } catch (err) {
    console.warn('Failed to set ledger owner:', err);
  }
}

/**
 * Quick count of all active user records stored in local storage
 */
export async function getLocalRecordCounts(): Promise<{
  parties: number;
  dispatches: number;
  payments: number;
  pos: number;
  total: number;
}> {
  const [parties, dispatches, payments, pos] = await Promise.all([
    getParties(),
    getDispatches(),
    getPayments(),
    getPurchaseOrders(),
  ]);
  const total = parties.length + dispatches.length + payments.length + pos.length;
  return {
    parties: parties.length,
    dispatches: dispatches.length,
    payments: payments.length,
    pos: pos.length,
    total,
  };
}

function safeSetStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.error(`localStorage quota exceeded or error writing ${key}:`, err);
    return false;
  }
}

/**
 * Strict numeric parser that guarantees a valid finite number:
 * - Empty string, null, undefined -> fallback (default 0)
 * - NaN, Infinity, -Infinity -> fallback (default 0)
 * - Strips accidental commas or whitespace
 */
export function cleanNumber(val: any, fallback = 0): number {
  if (typeof val === 'number') {
    return isNaN(val) || !isFinite(val) ? fallback : val;
  }
  if (val === null || val === undefined || val === '') {
    return fallback;
  }
  const str = String(val).replace(/,/g, '').trim();
  if (str === '') return fallback;
  const parsed = Number(str);
  return isNaN(parsed) || !isFinite(parsed) ? fallback : parsed;
}

/**
 * Robust JSON parser with rolling safety backup fallback to prevent accidental data wiping
 */
function safeParseStorage<T>(key: string, backupKey?: string): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Refresh rolling safety backup whenever a valid state is read
      if (backupKey && parsed.length > 0) {
        localStorage.setItem(backupKey, raw);
      }
      return parsed;
    }
    return [];
  } catch (err) {
    console.error(`[DB] Error parsing ${key} from storage:`, err);
    if (backupKey) {
      const backupRaw = localStorage.getItem(backupKey);
      if (backupRaw) {
        try {
          const backupParsed = JSON.parse(backupRaw);
          if (Array.isArray(backupParsed) && backupParsed.length > 0) {
            console.warn(`[DB] Successfully recovered ${backupParsed.length} records from ${backupKey}!`);
            return backupParsed;
          }
        } catch {}
      }
    }
    // Return empty array only if recovery failed, but DO NOT overwrite storage!
    return [];
  }
}

export function sanitizeDispatch(d: Partial<Dispatch>): Dispatch {
  const now = Date.now();
  return {
    id: d.id || '',
    partyId: d.partyId || '',
    poId: d.poId || undefined,
    date: d.date || new Date().toISOString().split('T')[0],
    truckNumber: d.truckNumber || '',
    factoryName: d.factoryName || '',
    targetGcv: cleanNumber(d.targetGcv),
    baseRate: cleanNumber(d.baseRate),
    commissionPerTon: d.commissionPerTon !== undefined ? cleanNumber(d.commissionPerTon) : undefined,
    labActualGcv: cleanNumber(d.labActualGcv),
    labReceivedWeight: cleanNumber(d.labReceivedWeight),
    labSulphur: cleanNumber(d.labSulphur),
    labAsh: d.labAsh !== undefined ? cleanNumber(d.labAsh) : undefined,
    labVm: d.labVm !== undefined ? cleanNumber(d.labVm) : undefined,
    labMoisture: d.labMoisture !== undefined ? cleanNumber(d.labMoisture) : undefined,
    manualDeduction: d.manualDeduction !== undefined ? cleanNumber(d.manualDeduction) : undefined,
    manualPremium: d.manualPremium !== undefined ? cleanNumber(d.manualPremium) : undefined,
    manualTax: d.manualTax !== undefined ? cleanNumber(d.manualTax) : undefined,
    taxMethod: d.taxMethod || 'manual',
    taxSalesPercent: d.taxSalesPercent !== undefined
      ? cleanNumber(d.taxSalesPercent)
      : (d.taxMethod === 'formula_18_5'
          ? (getCachedSettings()?.taxFormulaSalesPercent ?? 18)
          : undefined),
    taxIncomePercent: d.taxIncomePercent !== undefined
      ? cleanNumber(d.taxIncomePercent)
      : (d.taxMethod === 'formula_18_5'
          ? (getCachedSettings()?.taxFormulaIncomePercent ?? 5)
          : undefined),
    overheads: {
      loading: cleanNumber(d.overheads?.loading),
      freight: cleanNumber(d.overheads?.freight),
      crush: cleanNumber(d.overheads?.crush),
      royalty: cleanNumber(d.overheads?.royalty),
      other: cleanNumber(d.overheads?.other),
    },
    coalInputs: Array.isArray(d.coalInputs)
      ? d.coalInputs.map((ci) => ({
          id: ci.id || '',
          sourceName: ci.sourceName || '',
          weight: cleanNumber(ci.weight),
          purchaseRate: cleanNumber(ci.purchaseRate),
        }))
      : [],
    notes: d.notes || undefined,
    createdAt: cleanNumber(d.createdAt, now),
    updatedAt: now,
  };
}

export function sanitizePayment(p: Partial<Payment>): Payment {
  const now = Date.now();
  return {
    id: p.id || '',
    partyId: p.partyId || '',
    date: p.date || new Date().toISOString().split('T')[0],
    amount: cleanNumber(p.amount),
    type: p.type === 'paid' ? 'paid' : 'received',
    mode: p.mode || 'bank',
    referenceNote: p.referenceNote || undefined,
    createdAt: cleanNumber(p.createdAt, now),
    updatedAt: now,
  };
}

export function sanitizeParty(p: Partial<Party>): Party {
  const now = Date.now();
  return {
    id: p.id || '',
    name: p.name || '',
    contactPerson: p.contactPerson || '',
    phone: p.phone || '',
    address: p.address || '',
    createdAt: cleanNumber(p.createdAt, now),
    updatedAt: now,
  };
}

export function sanitizePurchaseOrder(po: Partial<PurchaseOrder>): PurchaseOrder {
  const now = Date.now();
  return {
    id: po.id || '',
    partyId: po.partyId || '',
    poNumber: po.poNumber || '',
    targetGcv: cleanNumber(po.targetGcv),
    baseRate: cleanNumber(po.baseRate),
    commissionPerTon: cleanNumber(po.commissionPerTon),
    totalTons: po.totalTons !== undefined ? cleanNumber(po.totalTons) : undefined,
    notes: po.notes || undefined,
    isActive: typeof po.isActive === 'boolean' ? po.isActive : true,
    createdAt: cleanNumber(po.createdAt, now),
    updatedAt: now,
  };
}

// Non-destructive initial storage check (NEVER wipes data on error)
function ensureSeeded() {
  const currentVersion = localStorage.getItem(DATA_VERSION_KEY);
  if (currentVersion !== CURRENT_DATA_VERSION) {
    try {
      const existingParties: Party[] = JSON.parse(localStorage.getItem(PARTIES_KEY) || '[]');
      const realParties = existingParties.filter(
        (p) => !p.id.startsWith('party-') && !p.id.startsWith('demo-')
      );
      if (realParties.length > 0 || existingParties.length > 0) {
        safeSetStorage(PARTIES_KEY, JSON.stringify(realParties));
      }

      const existingDispatches: Dispatch[] = JSON.parse(localStorage.getItem(DISPATCHES_KEY) || '[]');
      const realDispatches = existingDispatches.filter(
        (d) => !d.partyId.startsWith('party-') && !d.id.startsWith('disp-')
      );
      if (realDispatches.length > 0 || existingDispatches.length > 0) {
        safeSetStorage(DISPATCHES_KEY, JSON.stringify(realDispatches));
      }

      const existingPayments: Payment[] = JSON.parse(localStorage.getItem(PAYMENTS_KEY) || '[]');
      const realPayments = existingPayments.filter(
        (p) => !p.partyId.startsWith('party-') && !p.id.startsWith('pay-')
      );
      if (realPayments.length > 0 || existingPayments.length > 0) {
        safeSetStorage(PAYMENTS_KEY, JSON.stringify(realPayments));
      }

      const existingPos: PurchaseOrder[] = JSON.parse(localStorage.getItem(POS_KEY) || '[]');
      const realPos = existingPos.filter(
        (po) => !po.partyId.startsWith('party-') && !po.id.startsWith('po-')
      );
      if (realPos.length > 0 || existingPos.length > 0) {
        safeSetStorage(POS_KEY, JSON.stringify(realPos));
      }
    } catch (err) {
      console.warn('[DB] Warning in version migration check (preserving existing data):', err);
    }
    safeSetStorage(DATA_VERSION_KEY, CURRENT_DATA_VERSION);
    return;
  }

  if (!localStorage.getItem(PARTIES_KEY)) {
    safeSetStorage(PARTIES_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(DISPATCHES_KEY)) {
    safeSetStorage(DISPATCHES_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(PAYMENTS_KEY)) {
    safeSetStorage(PAYMENTS_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(SETTINGS_KEY)) {
    safeSetStorage(SETTINGS_KEY, JSON.stringify(INITIAL_SETTINGS));
  }
  if (!localStorage.getItem(POS_KEY)) {
    safeSetStorage(POS_KEY, JSON.stringify([]));
  }
}

// -- Dispatches --
export async function getDispatches(): Promise<Dispatch[]> {
  ensureSeeded();
  const rawList = safeParseStorage<Dispatch>(DISPATCHES_KEY, 'coal_ledger_safety_dispatches_bak');
  // Normalize historical dispatches: freeze any legacy formula dispatches to 18% & 5% so settings updates never shift them
  return rawList.map((d) => {
    if (d.taxMethod === 'formula_18_5') {
      if (typeof d.taxSalesPercent !== 'number') d.taxSalesPercent = 18;
      if (typeof d.taxIncomePercent !== 'number') d.taxIncomePercent = 5;
    }
    return d;
  });
}

export async function getDispatch(id: string): Promise<Dispatch | null> {
  const dispatches = await getDispatches();
  return dispatches.find((d) => d.id === id) || null;
}

export async function saveDispatch(dispatch: Dispatch): Promise<void> {
  const sanitized = sanitizeDispatch(dispatch);
  const dispatches = await getDispatches();
  const existingIndex = dispatches.findIndex((d) => d.id === sanitized.id);
  const now = Date.now();

  if (existingIndex >= 0) {
    dispatches[existingIndex] = { ...sanitized, updatedAt: now };
  } else {
    dispatches.unshift({
      ...sanitized,
      createdAt: sanitized.createdAt || now,
      updatedAt: now,
    });
  }

  if (dispatches.length > 0) {
    localStorage.setItem('coal_ledger_safety_dispatches_bak', JSON.stringify(dispatches));
  }
  safeSetStorage(DISPATCHES_KEY, JSON.stringify(dispatches));
  notifyLedgerMutation('dispatch', sanitized.id, existingIndex >= 0 ? 'update' : 'create');
}

export async function deleteDispatch(id: string): Promise<void> {
  const dispatches = await getDispatches();
  const filtered = dispatches.filter((d) => d.id !== id);
  recordTombstone(id);
  if (filtered.length > 0) {
    localStorage.setItem('coal_ledger_safety_dispatches_bak', JSON.stringify(filtered));
  }
  safeSetStorage(DISPATCHES_KEY, JSON.stringify(filtered));
  notifyLedgerMutation('dispatch', id, 'delete');
}

// -- Payments --
export async function getPayments(): Promise<Payment[]> {
  ensureSeeded();
  return safeParseStorage<Payment>(PAYMENTS_KEY, 'coal_ledger_safety_payments_bak');
}

export async function getPartyPayments(partyId: string): Promise<Payment[]> {
  const payments = await getPayments();
  return payments.filter((p) => p.partyId === partyId);
}

export async function savePayment(payment: Payment): Promise<void> {
  const sanitized = sanitizePayment(payment);
  const payments = await getPayments();
  const existingIndex = payments.findIndex((p) => p.id === sanitized.id);
  const now = Date.now();
  const itemToSave: Payment = {
    ...sanitized,
    createdAt: sanitized.createdAt || now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    payments[existingIndex] = itemToSave;
  } else {
    payments.unshift(itemToSave);
  }

  if (payments.length > 0) {
    localStorage.setItem('coal_ledger_safety_payments_bak', JSON.stringify(payments));
  }
  safeSetStorage(PAYMENTS_KEY, JSON.stringify(payments));
  notifyLedgerMutation('payment', sanitized.id, existingIndex >= 0 ? 'update' : 'create');
}

export async function deletePayment(id: string): Promise<void> {
  const payments = await getPayments();
  const filtered = payments.filter((p) => p.id !== id);
  recordTombstone(id);
  if (filtered.length > 0) {
    localStorage.setItem('coal_ledger_safety_payments_bak', JSON.stringify(filtered));
  }
  safeSetStorage(PAYMENTS_KEY, JSON.stringify(filtered));
  notifyLedgerMutation('payment', id, 'delete');
}

// -- Parties --
export async function getParties(): Promise<Party[]> {
  ensureSeeded();
  return safeParseStorage<Party>(PARTIES_KEY, 'coal_ledger_safety_parties_bak');
}

export async function getParty(id: string): Promise<Party | null> {
  const parties = await getParties();
  return parties.find((p) => p.id === id) || null;
}

export async function saveParty(party: Party): Promise<void> {
  const sanitized = sanitizeParty(party);
  const parties = await getParties();
  const existingIndex = parties.findIndex((p) => p.id === sanitized.id);
  const now = Date.now();
  const itemToSave: Party = {
    ...sanitized,
    createdAt: sanitized.createdAt || now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    parties[existingIndex] = itemToSave;
  } else {
    parties.unshift(itemToSave);
  }

  if (parties.length > 0) {
    localStorage.setItem('coal_ledger_safety_parties_bak', JSON.stringify(parties));
  }
  safeSetStorage(PARTIES_KEY, JSON.stringify(parties));
  notifyLedgerMutation('party', sanitized.id, existingIndex >= 0 ? 'update' : 'create');
}

export async function deleteParty(id: string): Promise<void> {
  const parties = await getParties();
  const filtered = parties.filter((p) => p.id !== id);
  recordTombstone(id);
  if (filtered.length > 0) {
    localStorage.setItem('coal_ledger_safety_parties_bak', JSON.stringify(filtered));
  }
  safeSetStorage(PARTIES_KEY, JSON.stringify(filtered));
  notifyLedgerMutation('party', id, 'delete');
}

// -- Purchase Orders --
export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  ensureSeeded();
  return safeParseStorage<PurchaseOrder>(POS_KEY, 'coal_ledger_safety_pos_bak');
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder | null> {
  const pos = await getPurchaseOrders();
  return pos.find((po) => po.id === id) || null;
}

export async function getPartyPurchaseOrders(partyId: string): Promise<PurchaseOrder[]> {
  const pos = await getPurchaseOrders();
  return pos.filter((po) => po.partyId === partyId);
}

export async function savePurchaseOrder(po: PurchaseOrder): Promise<void> {
  const sanitized = sanitizePurchaseOrder(po);
  const pos = await getPurchaseOrders();
  const existingIndex = pos.findIndex((p) => p.id === sanitized.id);
  const now = Date.now();
  const itemToSave: PurchaseOrder = {
    ...sanitized,
    createdAt: sanitized.createdAt || now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    pos[existingIndex] = itemToSave;
  } else {
    pos.unshift(itemToSave);
  }

  if (pos.length > 0) {
    localStorage.setItem('coal_ledger_safety_pos_bak', JSON.stringify(pos));
  }
  safeSetStorage(POS_KEY, JSON.stringify(pos));
  notifyLedgerMutation('purchase_order', sanitized.id, existingIndex >= 0 ? 'update' : 'create');
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  const pos = await getPurchaseOrders();
  const filtered = pos.filter((p) => p.id !== id);
  recordTombstone(id);
  if (filtered.length > 0) {
    localStorage.setItem('coal_ledger_safety_pos_bak', JSON.stringify(filtered));
  }
  safeSetStorage(POS_KEY, JSON.stringify(filtered));
  notifyLedgerMutation('purchase_order', id, 'delete');
}

// -- Settings --
let cachedSettings: AppSettings = INITIAL_SETTINGS;

export function getCachedSettings(): AppSettings {
  if (typeof window !== 'undefined' && (!cachedSettings.updatedAt || cachedSettings === INITIAL_SETTINGS)) {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        cachedSettings = {
          ...INITIAL_SETTINGS,
          ...parsed,
          numberFormat: parsed.numberFormat || 'million',
          taxFormulaSalesPercent: typeof parsed.taxFormulaSalesPercent === 'number' ? parsed.taxFormulaSalesPercent : 18,
          taxFormulaIncomePercent: typeof parsed.taxFormulaIncomePercent === 'number' ? parsed.taxFormulaIncomePercent : 5,
          appLockEnabled: Boolean(parsed.appLockEnabled),
          pinHash: parsed.pinHash || '',
          pinLength: typeof parsed.pinLength === 'number' ? parsed.pinLength : (parsed.pinHash ? 4 : 5),
          lockTimeout: typeof parsed.lockTimeout === 'number' ? parsed.lockTimeout : 0,
        };
      } catch {}
    }
  }
  return cachedSettings;
}

export async function getSettings(): Promise<AppSettings> {
  ensureSeeded();
  const data = localStorage.getItem(SETTINGS_KEY);
  if (!data) {
    cachedSettings = INITIAL_SETTINGS;
    return INITIAL_SETTINGS;
  }
  try {
    const parsed = JSON.parse(data);
    const merged: AppSettings = {
      ...INITIAL_SETTINGS,
      ...parsed,
      numberFormat: parsed.numberFormat || 'million',
      taxFormulaSalesPercent: typeof parsed.taxFormulaSalesPercent === 'number' ? parsed.taxFormulaSalesPercent : 18,
      taxFormulaIncomePercent: typeof parsed.taxFormulaIncomePercent === 'number' ? parsed.taxFormulaIncomePercent : 5,
      appLockEnabled: Boolean(parsed.appLockEnabled),
      pinHash: parsed.pinHash || '',
      pinLength: typeof parsed.pinLength === 'number' ? parsed.pinLength : (parsed.pinHash ? 4 : 5),
      lockTimeout: typeof parsed.lockTimeout === 'number' ? parsed.lockTimeout : 0,
    };
    cachedSettings = merged;
    return merged;
  } catch {
    cachedSettings = INITIAL_SETTINGS;
    return INITIAL_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const updatedSettings: AppSettings = {
    ...settings,
    numberFormat: settings.numberFormat || 'million',
    taxFormulaSalesPercent: typeof settings.taxFormulaSalesPercent === 'number' ? settings.taxFormulaSalesPercent : 18,
    taxFormulaIncomePercent: typeof settings.taxFormulaIncomePercent === 'number' ? settings.taxFormulaIncomePercent : 5,
    appLockEnabled: Boolean(settings.appLockEnabled),
    pinHash: settings.pinHash || '',
    pinLength: typeof settings.pinLength === 'number' ? settings.pinLength : (settings.pinHash ? 4 : 5),
    lockTimeout: typeof settings.lockTimeout === 'number' ? settings.lockTimeout : 0,
    updatedAt: Date.now(),
  };
  cachedSettings = updatedSettings;
  safeSetStorage(SETTINGS_KEY, JSON.stringify(updatedSettings));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app_settings_changed', { detail: updatedSettings }));
  }
  notifyLedgerMutation('settings', undefined, 'update');
}

// -- Backup & Restore helpers --
export interface BackupPayload {
  version?: string;
  exportDate: string;
  parties: Party[];
  dispatches: Dispatch[];
  payments: Payment[];
  pos: PurchaseOrder[];
  settings: AppSettings;
  deviceInfo?: string;
  lastCloudSync?: string;
}

export async function getAllBackupData(): Promise<BackupPayload> {
  const [parties, dispatches, payments, pos, settings] = await Promise.all([
    getParties(),
    getDispatches(),
    getPayments(),
    getPurchaseOrders(),
    getSettings(),
  ]);

  return {
    version: CURRENT_DATA_VERSION,
    exportDate: new Date().toISOString(),
    parties,
    dispatches,
    payments,
    pos,
    settings,
  };
}

/**
 * Generate sanitized backup payload for file export / sharing.
 * Exports EVERYTHING (parties, dispatches, payments, purchase orders, business branding & tax formula settings)
 * but STRIPS sensitive PIN hash and device lock credentials.
 */
export async function getExportBackupData(): Promise<BackupPayload> {
  const full = await getAllBackupData();
  const sanitizedSettings: AppSettings = {
    ...full.settings,
    appLockEnabled: false,
  };
  delete (sanitizedSettings as any).pinHash;
  delete (sanitizedSettings as any).pinLength;
  delete (sanitizedSettings as any).lockTimeout;

  return {
    ...full,
    settings: sanitizedSettings,
  };
}

export async function restoreBackup(
  backup: Partial<BackupPayload>,
  options?: { silent?: boolean }
): Promise<{ success: boolean; message: string; counts?: { parties: number; dispatches: number; payments: number; pos: number } }> {
  if (!backup || typeof backup !== 'object') {
    return { success: false, message: 'Invalid backup format' };
  }

  try {
    const parties = Array.isArray(backup.parties) ? backup.parties : [];
    const dispatches = Array.isArray(backup.dispatches) ? backup.dispatches : [];
    const payments = Array.isArray(backup.payments) ? backup.payments : [];
    const pos = Array.isArray(backup.pos) ? backup.pos : [];
    const rawSettings = backup.settings && typeof backup.settings === 'object' ? backup.settings : INITIAL_SETTINGS;
    // CRITICAL SECURITY PRESERVATION:
    // When restoring a backup file, never overwrite active device PIN or App Lock credentials
    const currentSettings = getCachedSettings();
    const settings: AppSettings = {
      ...INITIAL_SETTINGS,
      ...rawSettings,
      appLockEnabled: currentSettings.appLockEnabled ?? false,
      pinHash: currentSettings.pinHash ?? '',
      pinLength: currentSettings.pinLength ?? 5,
      lockTimeout: currentSettings.lockTimeout ?? 0,
    };

    safeSetStorage(PARTIES_KEY, JSON.stringify(parties));
    safeSetStorage(DISPATCHES_KEY, JSON.stringify(dispatches));
    safeSetStorage(PAYMENTS_KEY, JSON.stringify(payments));
    safeSetStorage(POS_KEY, JSON.stringify(pos));
    safeSetStorage(SETTINGS_KEY, JSON.stringify(settings));
    safeSetStorage(DATA_VERSION_KEY, CURRENT_DATA_VERSION);

    if (!options?.silent) {
      notifyLedgerMutation('all', undefined, 'restore');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app_settings_changed', { detail: settings }));
      }
    }

    return {
      success: true,
      message: 'Backup restored successfully!',
      counts: {
        parties: parties.length,
        dispatches: dispatches.length,
        payments: payments.length,
        pos: pos.length,
      }
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to parse and store backup' };
  }
}

export async function clearAllData(options?: { resetSettings?: boolean; resetOwner?: boolean }): Promise<void> {
  safeSetStorage(PARTIES_KEY, JSON.stringify([]));
  safeSetStorage(DISPATCHES_KEY, JSON.stringify([]));
  safeSetStorage(PAYMENTS_KEY, JSON.stringify([]));
  safeSetStorage(POS_KEY, JSON.stringify([]));
  safeSetStorage(TOMBSTONES_KEY, JSON.stringify({}));
  safeSetStorage(DATA_VERSION_KEY, CURRENT_DATA_VERSION);
  if (options?.resetSettings) {
    safeSetStorage(SETTINGS_KEY, JSON.stringify(INITIAL_SETTINGS));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app_settings_changed', { detail: INITIAL_SETTINGS }));
    }
  }
  if (options?.resetOwner) {
    setLedgerOwner(null, null);
  }
  notifyLedgerMutation('all', undefined, 'delete');
}

/**
 * Robust two-way merge between local and remote datasets:
 * - Uses record IDs as unique keys
 * - Uses timestamps (updatedAt / createdAt) to resolve individual conflicts (Last Write Wins)
 * - Honors tombstones so locally deleted records aren't resurrected by cloud data
 */
export function mergeLedgerData(
  local: BackupPayload,
  cloud: BackupPayload,
  tombstones: Record<string, number> = {}
): {
  merged: BackupPayload;
  hasLocalChanges: boolean;
  hasCloudChanges: boolean;
} {
  let hasLocalChanges = false;
  let hasCloudChanges = false;

  // 1. Parties
  const partyMap = new Map<string, Party>();
  const partyNameMap = new Map<string, Party>();
  const partyIdRemap = new Map<string, string>(); // incoming partyId -> local partyId

  for (const p of local.parties || []) {
    partyMap.set(p.id, p);
    if (p.name) {
      partyNameMap.set(p.name.trim().toLowerCase(), p);
    }
  }

  for (const cp of cloud.parties || []) {
    const deletedAt = tombstones[cp.id];
    const cloudTime = cp.updatedAt || cp.createdAt || 0;
    if (deletedAt && deletedAt > cloudTime) {
      // Was deleted locally after remote update; keep deleted
      hasCloudChanges = true;
      continue;
    }

    const existingById = partyMap.get(cp.id);
    const existingByName = cp.name ? partyNameMap.get(cp.name.trim().toLowerCase()) : undefined;

    if (existingById) {
      const localTime = existingById.updatedAt || existingById.createdAt || 0;
      if (cloudTime > localTime) {
        partyMap.set(cp.id, cp);
        hasLocalChanges = true;
      } else if (localTime > cloudTime) {
        hasCloudChanges = true;
      }
    } else if (existingByName) {
      // Identical party name with different UUID (e.g. independently created on another device)
      // Remap incoming entries to link to existing party card cleanly
      partyIdRemap.set(cp.id, existingByName.id);
      hasLocalChanges = true;
    } else {
      partyMap.set(cp.id, cp);
      if (cp.name) {
        partyNameMap.set(cp.name.trim().toLowerCase(), cp);
      }
      hasLocalChanges = true;
    }
  }

  // 2. Dispatches
  const dispatchMap = new Map<string, Dispatch>();
  for (const d of local.dispatches || []) {
    dispatchMap.set(d.id, d);
  }
  for (const cd of cloud.dispatches || []) {
    const deletedAt = tombstones[cd.id];
    const cloudTime = cd.updatedAt || cd.createdAt || 0;
    if (deletedAt && deletedAt > cloudTime) {
      hasCloudChanges = true;
      continue;
    }

    const targetPartyId = partyIdRemap.get(cd.partyId) || cd.partyId;
    const resolvedDispatch = targetPartyId !== cd.partyId ? { ...cd, partyId: targetPartyId } : cd;

    const existing = dispatchMap.get(cd.id);
    if (!existing) {
      dispatchMap.set(cd.id, resolvedDispatch);
      hasLocalChanges = true;
    } else {
      const localTime = existing.updatedAt || existing.createdAt || 0;
      if (cloudTime > localTime) {
        dispatchMap.set(cd.id, resolvedDispatch);
        hasLocalChanges = true;
      } else if (localTime > cloudTime) {
        hasCloudChanges = true;
      }
    }
  }

  // 3. Payments
  const paymentMap = new Map<string, Payment>();
  for (const p of local.payments || []) {
    paymentMap.set(p.id, p);
  }
  for (const cp of cloud.payments || []) {
    const deletedAt = tombstones[cp.id];
    const cloudTime = cp.updatedAt || cp.createdAt || 0;
    if (deletedAt && deletedAt > cloudTime) {
      hasCloudChanges = true;
      continue;
    }

    const targetPartyId = partyIdRemap.get(cp.partyId) || cp.partyId;
    const resolvedPayment = targetPartyId !== cp.partyId ? { ...cp, partyId: targetPartyId } : cp;

    const existing = paymentMap.get(cp.id);
    if (!existing) {
      paymentMap.set(cp.id, resolvedPayment);
      hasLocalChanges = true;
    } else {
      const localTime = existing.updatedAt || existing.createdAt || 0;
      if (cloudTime > localTime) {
        paymentMap.set(cp.id, resolvedPayment);
        hasLocalChanges = true;
      } else if (localTime > cloudTime) {
        hasCloudChanges = true;
      }
    }
  }

  // 4. Purchase Orders
  const poMap = new Map<string, PurchaseOrder>();
  for (const po of local.pos || []) {
    poMap.set(po.id, po);
  }
  for (const cpo of cloud.pos || []) {
    const deletedAt = tombstones[cpo.id];
    const cloudTime = cpo.updatedAt || cpo.createdAt || 0;
    if (deletedAt && deletedAt > cloudTime) {
      hasCloudChanges = true;
      continue;
    }

    const targetPartyId = partyIdRemap.get(cpo.partyId) || cpo.partyId;
    const resolvedPo = targetPartyId !== cpo.partyId ? { ...cpo, partyId: targetPartyId } : cpo;

    const existing = poMap.get(cpo.id);
    if (!existing) {
      poMap.set(cpo.id, resolvedPo);
      hasLocalChanges = true;
    } else {
      const localTime = existing.updatedAt || existing.createdAt || 0;
      if (cloudTime > localTime) {
        poMap.set(cpo.id, resolvedPo);
        hasLocalChanges = true;
      } else if (localTime > cloudTime) {
        hasCloudChanges = true;
      }
    }
  }

  // 5. Settings
  let mergedSettings = { ...local.settings };
  const cloudSettings = cloud.settings;
  if (cloudSettings) {
    const localHasInfo = Boolean(local.settings?.businessName || local.settings?.userName);
    const cloudHasInfo = Boolean(cloudSettings.businessName || cloudSettings.userName);
    const localTime = local.settings?.updatedAt || 0;
    const cloudTime = cloudSettings.updatedAt || 0;

    if (!localHasInfo && cloudHasInfo) {
      mergedSettings = { ...cloudSettings };
      hasLocalChanges = true;
    } else if (cloudTime > localTime) {
      mergedSettings = { ...cloudSettings };
      hasLocalChanges = true;
    } else if (localTime > cloudTime) {
      hasCloudChanges = true;
    }
  }

  // Always protect current device security credentials during merge
  mergedSettings = {
    ...mergedSettings,
    appLockEnabled: local.settings?.appLockEnabled ?? false,
    pinHash: local.settings?.pinHash ?? '',
    pinLength: local.settings?.pinLength ?? 5,
    lockTimeout: local.settings?.lockTimeout ?? 0,
  };

  const mergedParties = Array.from(partyMap.values());
  const mergedDispatches = Array.from(dispatchMap.values());
  const mergedPayments = Array.from(paymentMap.values());
  const mergedPos = Array.from(poMap.values());

  const merged: BackupPayload = {
    version: CURRENT_DATA_VERSION,
    exportDate: new Date().toISOString(),
    parties: mergedParties,
    dispatches: mergedDispatches,
    payments: mergedPayments,
    pos: mergedPos,
    settings: mergedSettings,
  };

  return { merged, hasLocalChanges, hasCloudChanges };
}

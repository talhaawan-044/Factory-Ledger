export interface CoalInput {
  id: string;
  sourceName: string;
  weight: number;
  purchaseRate: number;
  lotId?: string;
}

export interface OverheadExpenses {
  loading: number;
  freight: number;
  crush: number;
  royalty: number;
  other: number;
}

export interface PurchaseOrder {
  id: string;
  partyId: string;
  poNumber: string;
  targetGcv: number;
  baseRate: number;
  commissionPerTon: number;
  totalTons?: number;
  notes?: string;
  gcvAdjustment?: 'manual' | 'prorata';
  gcvAdjustmentRounding?: 'rupee' | 'paisa';
  createdAt: number;
  updatedAt?: number;
  isActive: boolean;
  deleted?: boolean;
  deletedAt?: number;
  dirty?: boolean;
}

export interface Dispatch {
  id: string;
  partyId: string;
  poId?: string;
  date: string;
  truckNumber: string;
  factoryName: string;
  targetGcv: number;
  baseRate: number;
  commissionPerTon?: number;
  coalInputs: CoalInput[];
  overheads: OverheadExpenses;
  labActualGcv: number;
  labSulphur: number;
  labAsh?: number;
  labVm?: number;
  labMoisture?: number;
  labReceivedWeight: number;
  manualDeduction?: number;
  manualPremium?: number;
  manualTax?: number;
  gcvAdjustment?: 'manual' | 'prorata';
  gcvAdjustmentRounding?: 'rupee' | 'paisa';
  taxMethod?: TaxMethod;
  taxSalesPercent?: number; // Snapshot of sales tax % (e.g. 18) when dispatch was saved
  taxIncomePercent?: number; // Snapshot of income tax % (e.g. 5) when dispatch was saved
  notes?: string;
  status?: 'pending' | 'settled';
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  deletedAt?: number;
  dirty?: boolean;
}

export type TaxMethod = 'manual' | 'formula_18_5';

export interface Party {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  address: string;
  createdAt: number;
  updatedAt?: number;
  isArchived?: boolean;
  deleted?: boolean;
  deletedAt?: number;
  dirty?: boolean;
}

export interface Payment {
  id: string;
  partyId: string;
  date: string;
  amount: number;
  type: 'received' | 'paid';
  mode: 'bank' | 'cash' | 'cheque' | 'online';
  referenceNote?: string;
  createdAt: number;
  updatedAt?: number;
  deleted?: boolean;
  deletedAt?: number;
  dirty?: boolean;
}

export interface AppSettings {
  userName: string;
  businessName: string;
  phoneNumber: string;
  logoUrl: string;
  signatureUrl?: string;
  theme: 'light' | 'dark' | 'system';
  currency?: string;
  locale?: string;
  numberFormat?: 'lakh' | 'million';
  defaultTaxMethod?: TaxMethod;
  taxFormulaSalesPercent?: number;
  taxFormulaIncomePercent?: number;
  accountType?: string;
  companyAddress?: string;
  ntnNumber?: string;
  updatedAt?: number;
  // Security & App Lock settings (synced to cloud)
  appLockEnabled?: boolean;
  pinHash?: string;
  pinLength?: number;
  lockTimeout?: number;
}

export interface InventoryLot {
  id: string;
  supplier: string;
  date: string; // YYYY-MM-DD
  billedWeight: number; // Tons billed by supplier (e.g. 30)
  receivedWeight: number; // Tons physically weighed & received at yard (e.g. 28.5)
  purchaseRate: number; // Supplier rate per billed ton (e.g. 20000)
  landedRate: number; // Landed cost per received ton: (billedWeight * purchaseRate) / receivedWeight
  grade?: string;
  gcv?: number;
  targetGcv?: number;
  truckNumber?: string;
  mineSource?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  deletedAt?: number;
  dirty?: boolean;
}

export interface BackupPayload {
  version?: string;
  exportDate: string;
  exportedAt?: string;
  createdAt?: string;
  app?: string;
  parties: Party[];
  dispatches: Dispatch[];
  payments: Payment[];
  pos: PurchaseOrder[];
  lots?: InventoryLot[];
  settings: AppSettings;
  deviceInfo?: string;
  lastCloudSync?: string;
  images?: Record<string, string>;
  meta?: Record<string, unknown>;
}



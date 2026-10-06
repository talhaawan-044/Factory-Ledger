export interface CoalInput {
  id: string;
  sourceName: string;
  weight: number;
  purchaseRate: number;
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
  createdAt: number;
  isActive: boolean;
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
  taxMethod?: TaxMethod;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type TaxMethod = 'manual' | 'formula_18_5';

export interface Party {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  address: string;
  createdAt: number;
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
}

export interface AppSettings {
  userName: string;
  businessName: string;
  phoneNumber: string;
  logoUrl: string;
  theme: 'light' | 'dark';
  currency?: string;
  companyAddress?: string;
  ntnNumber?: string;
}

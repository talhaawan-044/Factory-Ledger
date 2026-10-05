import type { Dispatch, Party, AppSettings, Payment, PurchaseOrder } from "../types";

const DISPATCHES_KEY = "dispatches";
const PARTIES_KEY = "parties";
const PAYMENTS_KEY = "payments";
const SETTINGS_KEY = "app_settings";
const POS_KEY = "purchase_orders";

// Helper functions for realistic date distribution
const getIsoDate = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86400000).toISOString().split("T")[0];
const getTs = (daysAgo: number) => Date.now() - daysAgo * 86400000;

// Concise, Punchy Party Names for Pakistan Coal & Cement Operations
export const INITIAL_PARTIES: Party[] = [
  {
    id: "party-bestway",
    name: "Bestway",
    contactPerson: "Tariq Mahmood",
    phone: "+92 300 8541290",
    address: "Hattar Industrial Area",
    createdAt: getTs(30),
  },
  {
    id: "party-lucky",
    name: "Lucky",
    contactPerson: "Kashif Rehman",
    phone: "+92 321 9054410",
    address: "Pezu Plant, Lakki",
    createdAt: getTs(28),
  },
  {
    id: "party-maple",
    name: "Maple Leaf",
    contactPerson: "Zahid Siddiqui",
    phone: "+92 333 5129980",
    address: "Iskanderabad, Mianwali",
    createdAt: getTs(26),
  },
  {
    id: "party-dgkhan",
    name: "DG Khan",
    contactPerson: "Irfan Qureshi",
    phone: "+92 345 8892100",
    address: "Chakwal Plant",
    createdAt: getTs(25),
  },
  {
    id: "party-fauji",
    name: "Fauji",
    contactPerson: "Col. Asad",
    phone: "+92 301 5567812",
    address: "Fateh Jang Site",
    createdAt: getTs(24),
  },
  {
    id: "party-cherat",
    name: "Cherat",
    contactPerson: "Engr. Noman",
    phone: "+92 312 9182345",
    address: "Nowshera, KPK",
    createdAt: getTs(22),
  },
  {
    id: "party-kohat",
    name: "Kohat",
    contactPerson: "Habibullah Khan",
    phone: "+92 334 9871230",
    address: "Rawalpindi Road, Kohat",
    createdAt: getTs(20),
  },
  {
    id: "party-askari",
    name: "Askari",
    contactPerson: "Maj. Rizwan",
    phone: "+92 300 4455667",
    address: "Nizampur Unit",
    createdAt: getTs(18),
  },
  {
    id: "party-attock",
    name: "Attock",
    contactPerson: "Suleman Butt",
    phone: "+92 322 7712398",
    address: "Hub Industrial Area",
    createdAt: getTs(17),
  },
  {
    id: "party-pioneer",
    name: "Pioneer",
    contactPerson: "Akram Sheikh",
    phone: "+92 302 8192034",
    address: "Joharabad, Khushab",
    createdAt: getTs(15),
  },
  {
    id: "party-power",
    name: "Power Cement",
    contactPerson: "Shahid Raza",
    phone: "+92 315 2299881",
    address: "Nooriabad, Sindh",
    createdAt: getTs(14),
  },
  {
    id: "party-tajwali",
    name: "Taj Wali",
    contactPerson: "Taj Wali Khan",
    phone: "+92 321 4053408",
    address: "Peshawar Yard",
    createdAt: getTs(12),
  },
  {
    id: "party-hajibilal",
    name: "Haji Bilal",
    contactPerson: "Bilal Ahmad",
    phone: "+92 333 9112233",
    address: "Chamalang Yard, Quetta",
    createdAt: getTs(10),
  },
  {
    id: "party-duki",
    name: "Duki Mines",
    contactPerson: "Malik Jahangir",
    phone: "+92 313 7789210",
    address: "Chamalang Block, Duki",
    createdAt: getTs(9),
  },
];

export const INITIAL_POS: PurchaseOrder[] = [
  { id: "po-bw", partyId: "party-bestway", poNumber: "PO-BW-2026", targetGcv: 6000, baseRate: 38500, commissionPerTon: 500, createdAt: getTs(25), isActive: true },
  { id: "po-lky", partyId: "party-lucky", poNumber: "PO-LKY-2026", targetGcv: 5800, baseRate: 36000, commissionPerTon: 450, createdAt: getTs(24), isActive: true },
  { id: "po-mpl", partyId: "party-maple", poNumber: "PO-MPL-2026", targetGcv: 6200, baseRate: 41500, commissionPerTon: 550, createdAt: getTs(22), isActive: true },
  { id: "po-dgk", partyId: "party-dgkhan", poNumber: "PO-DGK-2026", targetGcv: 5500, baseRate: 34000, commissionPerTon: 400, createdAt: getTs(20), isActive: true },
  { id: "po-fji", partyId: "party-fauji", poNumber: "PO-FJI-2026", targetGcv: 5900, baseRate: 37500, commissionPerTon: 450, createdAt: getTs(19), isActive: true },
  { id: "po-cht", partyId: "party-cherat", poNumber: "PO-CHT-2026", targetGcv: 6100, baseRate: 40000, commissionPerTon: 500, createdAt: getTs(18), isActive: true },
  { id: "po-kht", partyId: "party-kohat", poNumber: "PO-KHT-2026", targetGcv: 5700, baseRate: 35500, commissionPerTon: 400, createdAt: getTs(16), isActive: true },
  { id: "po-ask", partyId: "party-askari", poNumber: "PO-ASK-2026", targetGcv: 6000, baseRate: 39000, commissionPerTon: 450, createdAt: getTs(15), isActive: true },
  { id: "po-atk", partyId: "party-attock", poNumber: "PO-ATK-2026", targetGcv: 5600, baseRate: 34500, commissionPerTon: 350, createdAt: getTs(14), isActive: true },
  { id: "po-pnr", partyId: "party-pioneer", poNumber: "PO-PNR-2026", targetGcv: 5850, baseRate: 36500, commissionPerTon: 400, createdAt: getTs(12), isActive: true },
  { id: "po-pwr", partyId: "party-power", poNumber: "PO-PWR-2026", targetGcv: 5750, baseRate: 35000, commissionPerTon: 400, createdAt: getTs(10), isActive: true },
];

export const INITIAL_DISPATCHES: Dispatch[] = [
  // ── Bestway Dispatches ──
  {
    id: "disp-bw-1",
    partyId: "party-bestway",
    date: getIsoDate(1),
    truckNumber: "P-8821",
    factoryName: "Bestway",
    poId: "po-bw",
    targetGcv: 6000,
    baseRate: 38500,
    commissionPerTon: 500,
    coalInputs: [
      { id: "ci-bw1-1", sourceName: "Afghan 6200 NAR", weight: 22.5, purchaseRate: 29500 },
      { id: "ci-bw1-2", sourceName: "Duki Grade 1", weight: 17.5, purchaseRate: 32000 },
    ],
    overheads: { loading: 8500, freight: 48000, crush: 4500, royalty: 12000, other: 500 },
    labActualGcv: 5950,
    labSulphur: 4.1,
    labReceivedWeight: 39.8,
    createdAt: getTs(1),
    updatedAt: getTs(1),
  },
  {
    id: "disp-bw-2",
    partyId: "party-bestway",
    date: getIsoDate(5),
    truckNumber: "FD-7201",
    factoryName: "Bestway",
    poId: "po-bw",
    targetGcv: 6000,
    baseRate: 38500,
    commissionPerTon: 500,
    coalInputs: [
      { id: "ci-bw2-1", sourceName: "Indonesian 5000 GAR", weight: 24.0, purchaseRate: 28500 },
      { id: "ci-bw2-2", sourceName: "Afghan 6200 NAR", weight: 16.5, purchaseRate: 33000 },
    ],
    overheads: { loading: 8500, freight: 49000, crush: 4500, royalty: 12500, other: 500 },
    labActualGcv: 6040,
    labSulphur: 3.92,
    labReceivedWeight: 40.3,
    createdAt: getTs(5),
    updatedAt: getTs(5),
  },
  {
    id: "disp-bw-3",
    partyId: "party-bestway",
    date: getIsoDate(12),
    truckNumber: "KPK-1102",
    factoryName: "Bestway",
    poId: "po-bw",
    targetGcv: 6000,
    baseRate: 38500,
    commissionPerTon: 500,
    coalInputs: [
      { id: "ci-bw3-1", sourceName: "Afghan 6200 NAR", weight: 21.0, purchaseRate: 29000 },
      { id: "ci-bw3-2", sourceName: "Duki Grade 1", weight: 18.5, purchaseRate: 31500 },
    ],
    overheads: { loading: 8000, freight: 47500, crush: 4500, royalty: 11500, other: 500 },
    labActualGcv: 5180,
    labSulphur: 4.8,
    labMoisture: 14.8,
    manualDeduction: 6800,
    labReceivedWeight: 37.8,
    notes: "Plant lab rejected high moisture (14.8%) & low GCV (5,180 kcal). Penalty: -Rs. 6,800/t.",
    createdAt: getTs(12),
    updatedAt: getTs(12),
  },
  {
    id: "disp-bw-4",
    partyId: "party-bestway",
    date: getIsoDate(22),
    truckNumber: "LES-9941",
    factoryName: "Bestway",
    poId: "po-bw",
    targetGcv: 6000,
    baseRate: 38500,
    commissionPerTon: 500,
    coalInputs: [
      { id: "ci-bw4-1", sourceName: "Chamalang High Grade", weight: 23.5, purchaseRate: 30500 },
      { id: "ci-bw4-2", sourceName: "Lakhra Washed", weight: 17.0, purchaseRate: 25000 },
    ],
    overheads: { loading: 8000, freight: 47000, crush: 4000, royalty: 11500, other: 500 },
    labActualGcv: 5930,
    labSulphur: 4.25,
    labReceivedWeight: 40.1,
    createdAt: getTs(22),
    updatedAt: getTs(22),
  },

  // ── Lucky Dispatches ──
  {
    id: "disp-lky-1",
    partyId: "party-lucky",
    date: getIsoDate(2),
    truckNumber: "LES-4109",
    factoryName: "Lucky",
    poId: "po-lky",
    targetGcv: 5800,
    baseRate: 36000,
    commissionPerTon: 450,
    coalInputs: [
      { id: "ci-lky1-1", sourceName: "Lakhra Sind Coal", weight: 25.0, purchaseRate: 24500 },
      { id: "ci-lky1-2", sourceName: "Afghan 5800 NAR", weight: 17.0, purchaseRate: 31000 },
    ],
    overheads: { loading: 7500, freight: 42000, crush: 4000, royalty: 11000, other: 450 },
    labActualGcv: 5820,
    labSulphur: 3.85,
    labReceivedWeight: 41.7,
    createdAt: getTs(2),
    updatedAt: getTs(2),
  },
  {
    id: "disp-lky-2",
    partyId: "party-lucky",
    date: getIsoDate(7),
    truckNumber: "MN-4412",
    factoryName: "Lucky",
    poId: "po-lky",
    targetGcv: 5800,
    baseRate: 36000,
    commissionPerTon: 450,
    coalInputs: [
      { id: "ci-lky2-1", sourceName: "Duki ROM", weight: 23.0, purchaseRate: 24000 },
      { id: "ci-lky2-2", sourceName: "Afghan 5800 NAR", weight: 18.0, purchaseRate: 30500 },
    ],
    overheads: { loading: 7500, freight: 41500, crush: 4000, royalty: 10000, other: 500 },
    labActualGcv: 5790,
    labSulphur: 3.9,
    labReceivedWeight: 40.8,
    createdAt: getTs(7),
    updatedAt: getTs(7),
  },
  {
    id: "disp-lky-3",
    partyId: "party-lucky",
    date: getIsoDate(14),
    truckNumber: "P-3301",
    factoryName: "Lucky",
    poId: "po-lky",
    targetGcv: 5800,
    baseRate: 36000,
    commissionPerTon: 450,
    coalInputs: [
      { id: "ci-lky3-1", sourceName: "Lakhra Sind Coal", weight: 24.0, purchaseRate: 24800 },
      { id: "ci-lky3-2", sourceName: "Duki ROM", weight: 17.5, purchaseRate: 24200 },
    ],
    overheads: { loading: 7000, freight: 53000, crush: 3500, royalty: 10000, other: 500 },
    labActualGcv: 5240,
    labSulphur: 4.6,
    manualDeduction: 6800,
    labReceivedWeight: 36.4,
    notes: "High transit weight shortage (-5.1t) & shale penalty applied by Pezu lab.",
    createdAt: getTs(14),
    updatedAt: getTs(14),
  },
  {
    id: "disp-lky-4",
    partyId: "party-lucky",
    date: getIsoDate(24),
    truckNumber: "TK-5021",
    factoryName: "Lucky",
    poId: "po-lky",
    targetGcv: 5800,
    baseRate: 36000,
    commissionPerTon: 450,
    coalInputs: [
      { id: "ci-lky4-1", sourceName: "Afghan 5800 NAR", weight: 22.0, purchaseRate: 31000 },
      { id: "ci-lky4-2", sourceName: "Lakhra Sind Coal", weight: 19.0, purchaseRate: 24500 },
    ],
    overheads: { loading: 7500, freight: 42500, crush: 4000, royalty: 10500, other: 500 },
    labActualGcv: 5840,
    labSulphur: 3.8,
    labReceivedWeight: 40.6,
    createdAt: getTs(24),
    updatedAt: getTs(24),
  },

  // ── Maple Leaf Dispatches ──
  {
    id: "disp-mpl-1",
    partyId: "party-maple",
    date: getIsoDate(3),
    truckNumber: "TK-1992",
    factoryName: "Maple Leaf",
    poId: "po-mpl",
    targetGcv: 6200,
    baseRate: 41500,
    commissionPerTon: 550,
    coalInputs: [
      { id: "ci-mpl1-1", sourceName: "South African RB3", weight: 21.0, purchaseRate: 33500 },
      { id: "ci-mpl1-2", sourceName: "Afghan 6400 High GCV", weight: 16.0, purchaseRate: 34500 },
    ],
    overheads: { loading: 9000, freight: 52000, crush: 5000, royalty: 13500, other: 550 },
    labActualGcv: 6160,
    labSulphur: 4.08,
    labReceivedWeight: 36.8,
    createdAt: getTs(3),
    updatedAt: getTs(3),
  },
  {
    id: "disp-mpl-2",
    partyId: "party-maple",
    date: getIsoDate(9),
    truckNumber: "LHR-7721",
    factoryName: "Maple Leaf",
    poId: "po-mpl",
    targetGcv: 6200,
    baseRate: 41500,
    commissionPerTon: 550,
    coalInputs: [
      { id: "ci-mpl2-1", sourceName: "Afghan 6400 High GCV", weight: 22.5, purchaseRate: 34000 },
      { id: "ci-mpl2-2", sourceName: "South African RB3", weight: 16.5, purchaseRate: 33000 },
    ],
    overheads: { loading: 9500, freight: 53000, crush: 5000, royalty: 13500, other: 500 },
    labActualGcv: 6220,
    labSulphur: 3.95,
    labReceivedWeight: 38.6,
    createdAt: getTs(9),
    updatedAt: getTs(9),
  },
  {
    id: "disp-mpl-3",
    partyId: "party-maple",
    date: getIsoDate(18),
    truckNumber: "KBL-9012",
    factoryName: "Maple Leaf",
    poId: "po-mpl",
    targetGcv: 6200,
    baseRate: 41500,
    commissionPerTon: 550,
    coalInputs: [
      { id: "ci-mpl3-1", sourceName: "Afghan 6400 High GCV", weight: 20.0, purchaseRate: 34500 },
      { id: "ci-mpl3-2", sourceName: "Chamalang High Grade", weight: 17.5, purchaseRate: 32000 },
    ],
    overheads: { loading: 9000, freight: 54000, crush: 4500, royalty: 13500, other: 500 },
    labActualGcv: 5410,
    labSulphur: 4.95,
    manualDeduction: 7500,
    labReceivedWeight: 36.5,
    notes: "Severe GCV drop (5,410 kcal vs 6,200 spec). Maple Leaf lab applied -Rs. 7,500/t deduction.",
    createdAt: getTs(18),
    updatedAt: getTs(18),
  },

  // ── DG Khan Dispatches ──
  {
    id: "disp-dgk-1",
    partyId: "party-dgkhan",
    date: getIsoDate(4),
    truckNumber: "KPK-5514",
    factoryName: "DG Khan",
    poId: "po-dgk",
    targetGcv: 5500,
    baseRate: 34000,
    commissionPerTon: 400,
    coalInputs: [
      { id: "ci-dgk1-1", sourceName: "Duki Local ROM", weight: 26.0, purchaseRate: 23500 },
      { id: "ci-dgk1-2", sourceName: "Lakhra Washed", weight: 14.0, purchaseRate: 25000 },
    ],
    overheads: { loading: 7000, freight: 39000, crush: 3500, royalty: 10000, other: 400 },
    labActualGcv: 5430,
    labSulphur: 4.45,
    labReceivedWeight: 39.5,
    createdAt: getTs(4),
    updatedAt: getTs(4),
  },
  {
    id: "disp-dgk-2",
    partyId: "party-dgkhan",
    date: getIsoDate(11),
    truckNumber: "FD-3319",
    factoryName: "DG Khan",
    poId: "po-dgk",
    targetGcv: 5500,
    baseRate: 34000,
    commissionPerTon: 400,
    coalInputs: [
      { id: "ci-dgk2-1", sourceName: "Duki Local ROM", weight: 24.0, purchaseRate: 23500 },
      { id: "ci-dgk2-2", sourceName: "Duki ROM", weight: 16.5, purchaseRate: 23000 },
    ],
    overheads: { loading: 7000, freight: 46500, crush: 3500, royalty: 9500, other: 400 },
    labActualGcv: 4890,
    labSulphur: 4.8,
    manualDeduction: 6800,
    labReceivedWeight: 36.5,
    notes: "Low GCV deduction (-Rs. 6,800/t) & weighbridge shortfall (-4.0t).",
    createdAt: getTs(11),
    updatedAt: getTs(11),
  },
  {
    id: "disp-dgk-3",
    partyId: "party-dgkhan",
    date: getIsoDate(21),
    truckNumber: "MN-8021",
    factoryName: "DG Khan",
    poId: "po-dgk",
    targetGcv: 5500,
    baseRate: 34000,
    commissionPerTon: 400,
    coalInputs: [
      { id: "ci-dgk3-1", sourceName: "Lakhra Washed", weight: 25.0, purchaseRate: 24800 },
      { id: "ci-dgk3-2", sourceName: "Duki Local ROM", weight: 15.5, purchaseRate: 23500 },
    ],
    overheads: { loading: 7200, freight: 39500, crush: 3500, royalty: 9800, other: 400 },
    labActualGcv: 5480,
    labSulphur: 4.38,
    labReceivedWeight: 40.0,
    createdAt: getTs(21),
    updatedAt: getTs(21),
  },

  // ── Fauji Dispatches ──
  {
    id: "disp-fji-1",
    partyId: "party-fauji",
    date: getIsoDate(2),
    truckNumber: "PR-6612",
    factoryName: "Fauji",
    poId: "po-fji",
    targetGcv: 5900,
    baseRate: 37500,
    commissionPerTon: 450,
    coalInputs: [
      { id: "ci-fji1-1", sourceName: "Afghan 6000 NAR", weight: 23.0, purchaseRate: 29000 },
      { id: "ci-fji1-2", sourceName: "Duki Grade 1", weight: 18.0, purchaseRate: 30500 },
    ],
    overheads: { loading: 8000, freight: 46000, crush: 4500, royalty: 12000, other: 500 },
    labActualGcv: 5920,
    labSulphur: 3.98,
    labReceivedWeight: 40.5,
    createdAt: getTs(2),
    updatedAt: getTs(2),
  },
  {
    id: "disp-fji-2",
    partyId: "party-fauji",
    date: getIsoDate(8),
    truckNumber: "P-7744",
    factoryName: "Fauji",
    poId: "po-fji",
    targetGcv: 5900,
    baseRate: 37500,
    commissionPerTon: 450,
    coalInputs: [
      { id: "ci-fji2-1", sourceName: "Chamalang High Grade", weight: 22.0, purchaseRate: 30000 },
      { id: "ci-fji2-2", sourceName: "Afghan 6000 NAR", weight: 18.5, purchaseRate: 29500 },
    ],
    overheads: { loading: 8500, freight: 47000, crush: 4500, royalty: 12000, other: 500 },
    labActualGcv: 5210,
    labSulphur: 4.85,
    manualDeduction: 7200,
    labReceivedWeight: 38.0,
    notes: "High ash (24.8%) & GCV penalty (-Rs. 7,200/t) billed by Fauji.",
    createdAt: getTs(8),
    updatedAt: getTs(8),
  },
  {
    id: "disp-fji-3",
    partyId: "party-fauji",
    date: getIsoDate(19),
    truckNumber: "KBL-3301",
    factoryName: "Fauji",
    poId: "po-fji",
    targetGcv: 5900,
    baseRate: 37500,
    commissionPerTon: 450,
    coalInputs: [
      { id: "ci-fji3-1", sourceName: "Indonesian 5000 GAR", weight: 24.5, purchaseRate: 28000 },
      { id: "ci-fji3-2", sourceName: "Afghan 6000 NAR", weight: 16.0, purchaseRate: 29800 },
    ],
    overheads: { loading: 8000, freight: 45500, crush: 4500, royalty: 11500, other: 500 },
    labActualGcv: 5940,
    labSulphur: 3.9,
    labReceivedWeight: 39.8,
    createdAt: getTs(19),
    updatedAt: getTs(19),
  },

  // ── Cherat Dispatches ──
  {
    id: "disp-cht-1",
    partyId: "party-cherat",
    date: getIsoDate(1),
    truckNumber: "TK-8819",
    factoryName: "Cherat",
    poId: "po-cht",
    targetGcv: 6100,
    baseRate: 40000,
    commissionPerTon: 500,
    coalInputs: [
      { id: "ci-cht1-1", sourceName: "Afghan High GCV", weight: 22.0, purchaseRate: 32000 },
      { id: "ci-cht1-2", sourceName: "Chamalang High Grade", weight: 17.5, purchaseRate: 31500 },
    ],
    overheads: { loading: 8500, freight: 49000, crush: 4500, royalty: 12500, other: 500 },
    labActualGcv: 6120,
    labSulphur: 3.82,
    labReceivedWeight: 39.2,
    createdAt: getTs(1),
    updatedAt: getTs(1),
  },
  {
    id: "disp-cht-2",
    partyId: "party-cherat",
    date: getIsoDate(6),
    truckNumber: "LES-1120",
    factoryName: "Cherat",
    poId: "po-cht",
    targetGcv: 6100,
    baseRate: 40000,
    commissionPerTon: 500,
    coalInputs: [
      { id: "ci-cht2-1", sourceName: "Afghan High GCV", weight: 23.5, purchaseRate: 32500 },
      { id: "ci-cht2-2", sourceName: "Duki Washed", weight: 17.0, purchaseRate: 31000 },
    ],
    overheads: { loading: 8500, freight: 50000, crush: 4500, royalty: 12500, other: 500 },
    labActualGcv: 6080,
    labSulphur: 3.95,
    labReceivedWeight: 40.2,
    createdAt: getTs(6),
    updatedAt: getTs(6),
  },
  {
    id: "disp-cht-3",
    partyId: "party-cherat",
    date: getIsoDate(16),
    truckNumber: "P-9081",
    factoryName: "Cherat",
    poId: "po-cht",
    targetGcv: 6100,
    baseRate: 40000,
    commissionPerTon: 500,
    coalInputs: [
      { id: "ci-cht3-1", sourceName: "South African RB3", weight: 21.5, purchaseRate: 33000 },
      { id: "ci-cht3-2", sourceName: "Afghan High GCV", weight: 18.0, purchaseRate: 32000 },
    ],
    overheads: { loading: 9000, freight: 53000, crush: 4500, royalty: 12500, other: 500 },
    labActualGcv: 5450,
    labSulphur: 4.95,
    manualDeduction: 6800,
    labReceivedWeight: 36.8,
    notes: "High sulphur deduction & GCV shortfall (-Rs. 6,800/t) deducted by Cherat.",
    createdAt: getTs(16),
    updatedAt: getTs(16),
  },

  // ── Kohat Dispatches ──
  {
    id: "disp-kht-1",
    partyId: "party-kohat",
    date: getIsoDate(3),
    truckNumber: "KPK-9912",
    factoryName: "Kohat",
    poId: "po-kht",
    targetGcv: 5700,
    baseRate: 35500,
    commissionPerTon: 400,
    coalInputs: [
      { id: "ci-kht1-1", sourceName: "Duki Grade 1", weight: 24.0, purchaseRate: 25500 },
      { id: "ci-kht1-2", sourceName: "Lakhra Sind Coal", weight: 17.0, purchaseRate: 24000 },
    ],
    overheads: { loading: 7500, freight: 41000, crush: 4000, royalty: 10000, other: 500 },
    labActualGcv: 5730,
    labSulphur: 4.1,
    labReceivedWeight: 40.6,
    createdAt: getTs(3),
    updatedAt: getTs(3),
  },
  {
    id: "disp-kht-2",
    partyId: "party-kohat",
    date: getIsoDate(10),
    truckNumber: "FD-4421",
    factoryName: "Kohat",
    poId: "po-kht",
    targetGcv: 5700,
    baseRate: 35500,
    commissionPerTon: 400,
    coalInputs: [
      { id: "ci-kht2-1", sourceName: "Afghan 5600 NAR", weight: 22.0, purchaseRate: 27500 },
      { id: "ci-kht2-2", sourceName: "Duki Grade 1", weight: 18.5, purchaseRate: 25500 },
    ],
    overheads: { loading: 7500, freight: 45000, crush: 4000, royalty: 10500, other: 500 },
    labActualGcv: 5080,
    labSulphur: 4.75,
    manualDeduction: 6400,
    labReceivedWeight: 37.0,
    notes: "Plant lab penalized for low calorific value (-Rs. 6,400/t) and weighbridge loss.",
    createdAt: getTs(10),
    updatedAt: getTs(10),
  },
  {
    id: "disp-kht-3",
    partyId: "party-kohat",
    date: getIsoDate(23),
    truckNumber: "PR-8810",
    factoryName: "Kohat",
    poId: "po-kht",
    targetGcv: 5700,
    baseRate: 35500,
    commissionPerTon: 400,
    coalInputs: [
      { id: "ci-kht3-1", sourceName: "Duki Grade 1", weight: 25.0, purchaseRate: 25000 },
      { id: "ci-kht3-2", sourceName: "Lakhra Sind Coal", weight: 16.0, purchaseRate: 24200 },
    ],
    overheads: { loading: 7000, freight: 40500, crush: 4000, royalty: 10000, other: 500 },
    labActualGcv: 5710,
    labSulphur: 4.18,
    labReceivedWeight: 40.8,
    createdAt: getTs(23),
    updatedAt: getTs(23),
  },

  // ── Askari Dispatches ──
  {
    id: "disp-ask-1",
    partyId: "party-askari",
    date: getIsoDate(4),
    truckNumber: "MN-1109",
    factoryName: "Askari",
    poId: "po-ask",
    targetGcv: 6000,
    baseRate: 39000,
    commissionPerTon: 450,
    coalInputs: [
      { id: "ci-ask1-1", sourceName: "Afghan 6000 NAR", weight: 22.5, purchaseRate: 30500 },
      { id: "ci-ask1-2", sourceName: "Chamalang High Grade", weight: 17.5, purchaseRate: 31000 },
    ],
    overheads: { loading: 8500, freight: 47500, crush: 4500, royalty: 12000, other: 500 },
    labActualGcv: 6020,
    labSulphur: 3.9,
    labReceivedWeight: 39.7,
    createdAt: getTs(4),
    updatedAt: getTs(4),
  },
  {
    id: "disp-ask-2",
    partyId: "party-askari",
    date: getIsoDate(13),
    truckNumber: "P-4402",
    factoryName: "Askari",
    poId: "po-ask",
    targetGcv: 6000,
    baseRate: 39000,
    commissionPerTon: 450,
    coalInputs: [
      { id: "ci-ask2-1", sourceName: "Afghan 6000 NAR", weight: 23.0, purchaseRate: 30500 },
      { id: "ci-ask2-2", sourceName: "Duki Washed", weight: 17.0, purchaseRate: 30000 },
    ],
    overheads: { loading: 8500, freight: 47000, crush: 4500, royalty: 11500, other: 500 },
    labActualGcv: 5970,
    labSulphur: 4.02,
    labReceivedWeight: 39.8,
    createdAt: getTs(13),
    updatedAt: getTs(13),
  },

  // ── Attock Dispatches ──
  {
    id: "disp-atk-1",
    partyId: "party-attock",
    date: getIsoDate(5),
    truckNumber: "KBL-7714",
    factoryName: "Attock",
    poId: "po-atk",
    targetGcv: 5600,
    baseRate: 34500,
    commissionPerTon: 350,
    coalInputs: [
      { id: "ci-atk1-1", sourceName: "Lakhra Local", weight: 25.0, purchaseRate: 24000 },
      { id: "ci-atk1-2", sourceName: "Duki Local ROM", weight: 16.5, purchaseRate: 23500 },
    ],
    overheads: { loading: 7000, freight: 38500, crush: 3500, royalty: 9500, other: 500 },
    labActualGcv: 5610,
    labSulphur: 4.4,
    labReceivedWeight: 41.2,
    createdAt: getTs(5),
    updatedAt: getTs(5),
  },
  {
    id: "disp-atk-2",
    partyId: "party-attock",
    date: getIsoDate(15),
    truckNumber: "TK-2281",
    factoryName: "Attock",
    poId: "po-atk",
    targetGcv: 5600,
    baseRate: 34500,
    commissionPerTon: 350,
    coalInputs: [
      { id: "ci-atk2-1", sourceName: "Duki Local ROM", weight: 24.5, purchaseRate: 23800 },
      { id: "ci-atk2-2", sourceName: "Lakhra Local", weight: 16.5, purchaseRate: 24000 },
    ],
    overheads: { loading: 7200, freight: 39000, crush: 3500, royalty: 10000, other: 500 },
    labActualGcv: 5580,
    labSulphur: 4.45,
    labReceivedWeight: 40.5,
    createdAt: getTs(15),
    updatedAt: getTs(15),
  },

  // ── Pioneer Dispatches ──
  {
    id: "disp-pnr-1",
    partyId: "party-pioneer",
    date: getIsoDate(3),
    truckNumber: "LES-6641",
    factoryName: "Pioneer",
    poId: "po-pnr",
    targetGcv: 5850,
    baseRate: 36500,
    commissionPerTon: 400,
    coalInputs: [
      { id: "ci-pnr1-1", sourceName: "Chamalang Grade 2", weight: 23.0, purchaseRate: 27500 },
      { id: "ci-pnr1-2", sourceName: "Duki Washed", weight: 18.0, purchaseRate: 26000 },
    ],
    overheads: { loading: 7500, freight: 43500, crush: 4000, royalty: 10500, other: 500 },
    labActualGcv: 5870,
    labSulphur: 3.95,
    labReceivedWeight: 40.5,
    createdAt: getTs(3),
    updatedAt: getTs(3),
  },
  {
    id: "disp-pnr-2",
    partyId: "party-pioneer",
    date: getIsoDate(14),
    truckNumber: "FD-9902",
    factoryName: "Pioneer",
    poId: "po-pnr",
    targetGcv: 5850,
    baseRate: 36500,
    commissionPerTon: 400,
    coalInputs: [
      { id: "ci-pnr2-1", sourceName: "Afghan 5800 NAR", weight: 22.0, purchaseRate: 29000 },
      { id: "ci-pnr2-2", sourceName: "Duki Washed", weight: 18.5, purchaseRate: 26000 },
    ],
    overheads: { loading: 7500, freight: 46000, crush: 4000, royalty: 11000, other: 500 },
    labActualGcv: 5200,
    labSulphur: 4.65,
    manualDeduction: 6200,
    labReceivedWeight: 37.5,
    notes: "Moisture penalty (-Rs. 6,200/t) & transit loss on weighbridge.",
    createdAt: getTs(14),
    updatedAt: getTs(14),
  },

  // ── Power Cement Dispatches ──
  {
    id: "disp-pwr-1",
    partyId: "party-power",
    date: getIsoDate(4),
    truckNumber: "P-1288",
    factoryName: "Power Cement",
    poId: "po-pwr",
    targetGcv: 5750,
    baseRate: 35000,
    commissionPerTon: 400,
    coalInputs: [
      { id: "ci-pwr1-1", sourceName: "Lakhra Washed", weight: 25.0, purchaseRate: 24500 },
      { id: "ci-pwr1-2", sourceName: "Duki Grade 2", weight: 16.0, purchaseRate: 23500 },
    ],
    overheads: { loading: 7000, freight: 40000, crush: 3500, royalty: 10000, other: 500 },
    labActualGcv: 5760,
    labSulphur: 4.15,
    labReceivedWeight: 40.8,
    createdAt: getTs(4),
    updatedAt: getTs(4),
  },
  {
    id: "disp-pwr-2",
    partyId: "party-power",
    date: getIsoDate(17),
    truckNumber: "MN-7731",
    factoryName: "Power Cement",
    poId: "po-pwr",
    targetGcv: 5750,
    baseRate: 35000,
    commissionPerTon: 400,
    coalInputs: [
      { id: "ci-pwr2-1", sourceName: "Duki Grade 2", weight: 24.0, purchaseRate: 23500 },
      { id: "ci-pwr2-2", sourceName: "Lakhra Washed", weight: 17.0, purchaseRate: 24500 },
    ],
    overheads: { loading: 7500, freight: 41000, crush: 3500, royalty: 9500, other: 500 },
    labActualGcv: 5720,
    labSulphur: 4.22,
    labReceivedWeight: 40.7,
    createdAt: getTs(17),
    updatedAt: getTs(17),
  },

  // ── Taj Wali Dispatches ──
  {
    id: "disp-tjw-1",
    partyId: "party-tajwali",
    date: getIsoDate(2),
    truckNumber: "KPK-3310",
    factoryName: "Taj Wali",
    targetGcv: 5300,
    baseRate: 33000,
    commissionPerTon: 300,
    coalInputs: [
      { id: "ci-tjw1-1", sourceName: "Duki Local ROM", weight: 22.0, purchaseRate: 23000 },
      { id: "ci-tjw1-2", sourceName: "Lakhra ROM", weight: 17.0, purchaseRate: 22000 },
    ],
    overheads: { loading: 6000, freight: 34000, crush: 3000, royalty: 8500, other: 500 },
    labActualGcv: 5310,
    labSulphur: 4.5,
    labReceivedWeight: 38.6,
    createdAt: getTs(2),
    updatedAt: getTs(2),
  },
  {
    id: "disp-tjw-2",
    partyId: "party-tajwali",
    date: getIsoDate(11),
    truckNumber: "PR-5529",
    factoryName: "Taj Wali",
    targetGcv: 5300,
    baseRate: 33000,
    commissionPerTon: 300,
    coalInputs: [
      { id: "ci-tjw2-1", sourceName: "Duki Local ROM", weight: 22.5, purchaseRate: 23000 },
      { id: "ci-tjw2-2", sourceName: "Lakhra ROM", weight: 16.5, purchaseRate: 22000 },
    ],
    overheads: { loading: 6000, freight: 34500, crush: 3000, royalty: 8500, other: 500 },
    labActualGcv: 5280,
    labSulphur: 4.6,
    labReceivedWeight: 38.7,
    createdAt: getTs(11),
    updatedAt: getTs(11),
  },

  // ── Haji Bilal Dispatches ──
  {
    id: "disp-hjb-1",
    partyId: "party-hajibilal",
    date: getIsoDate(3),
    truckNumber: "TK-4402",
    factoryName: "Haji Bilal",
    targetGcv: 5200,
    baseRate: 32000,
    commissionPerTon: 300,
    coalInputs: [
      { id: "ci-hjb1-1", sourceName: "Chamalang Small", weight: 23.0, purchaseRate: 22000 },
      { id: "ci-hjb1-2", sourceName: "Duki Slack", weight: 16.0, purchaseRate: 21500 },
    ],
    overheads: { loading: 6000, freight: 33000, crush: 2500, royalty: 8000, other: 500 },
    labActualGcv: 5220,
    labSulphur: 4.65,
    labReceivedWeight: 38.5,
    createdAt: getTs(3),
    updatedAt: getTs(3),
  },
  {
    id: "disp-hjb-2",
    partyId: "party-hajibilal",
    date: getIsoDate(13),
    truckNumber: "LES-8812",
    factoryName: "Haji Bilal",
    targetGcv: 5200,
    baseRate: 32000,
    commissionPerTon: 300,
    coalInputs: [
      { id: "ci-hjb2-1", sourceName: "Chamalang Small", weight: 22.5, purchaseRate: 22000 },
      { id: "ci-hjb2-2", sourceName: "Duki Slack", weight: 16.0, purchaseRate: 21500 },
    ],
    overheads: { loading: 6000, freight: 33500, crush: 2500, royalty: 8500, other: 500 },
    labActualGcv: 5190,
    labSulphur: 4.7,
    labReceivedWeight: 38.2,
    createdAt: getTs(13),
    updatedAt: getTs(13),
  },

  // ── Duki Mines Dispatches ──
  {
    id: "disp-dkm-1",
    partyId: "party-duki",
    date: getIsoDate(4),
    truckNumber: "KBL-1190",
    factoryName: "Duki Mines",
    targetGcv: 5350,
    baseRate: 32500,
    commissionPerTon: 300,
    coalInputs: [
      { id: "ci-dkm1-1", sourceName: "Duki Mine Run", weight: 23.5, purchaseRate: 22500 },
      { id: "ci-dkm1-2", sourceName: "Lakhra Crude", weight: 16.0, purchaseRate: 21000 },
    ],
    overheads: { loading: 6000, freight: 34000, crush: 2500, royalty: 8000, other: 500 },
    labActualGcv: 5360,
    labSulphur: 4.5,
    labReceivedWeight: 38.9,
    createdAt: getTs(4),
    updatedAt: getTs(4),
  },
  {
    id: "disp-dkm-2",
    partyId: "party-duki",
    date: getIsoDate(16),
    truckNumber: "P-6651",
    factoryName: "Duki Mines",
    targetGcv: 5350,
    baseRate: 32500,
    commissionPerTon: 300,
    coalInputs: [
      { id: "ci-dkm2-1", sourceName: "Duki Mine Run", weight: 23.0, purchaseRate: 22500 },
      { id: "ci-dkm2-2", sourceName: "Lakhra Crude", weight: 16.0, purchaseRate: 21000 },
    ],
    overheads: { loading: 6000, freight: 34500, crush: 2500, royalty: 8000, other: 500 },
    labActualGcv: 5320,
    labSulphur: 4.58,
    labReceivedWeight: 38.6,
    createdAt: getTs(16),
    updatedAt: getTs(16),
  },
];

export const INITIAL_PAYMENTS: Payment[] = [
  // Bestway: Billed ~6,100,000 -> Paid 4,500,000 -> Due ~1,600,000
  {
    id: "pay-bw-1",
    partyId: "party-bestway",
    date: getIsoDate(18),
    amount: 2500000,
    type: "received",
    mode: "bank",
    referenceNote: "HBL Corporate RTGS #88210",
    createdAt: getTs(18),
  },
  {
    id: "pay-bw-2",
    partyId: "party-bestway",
    date: getIsoDate(5),
    amount: 2000000,
    type: "received",
    mode: "bank",
    referenceNote: "Meezan Bank Online Transfer #44120",
    createdAt: getTs(5),
  },

  // Lucky: Billed ~5,900,000 -> Paid 5,900,000 -> Settled (0 Due)
  {
    id: "pay-lky-1",
    partyId: "party-lucky",
    date: getIsoDate(20),
    amount: 3000000,
    type: "received",
    mode: "bank",
    referenceNote: "Bank Alfalah Pay Order #9021",
    createdAt: getTs(20),
  },
  {
    id: "pay-lky-2",
    partyId: "party-lucky",
    date: getIsoDate(3),
    amount: 2400000,
    type: "received",
    mode: "cheque",
    referenceNote: "MCB Clearing Cheque #31088",
    createdAt: getTs(3),
  },

  // Maple Leaf: Billed ~4,650,000 -> Paid 3,200,000 -> Due ~1,450,000
  {
    id: "pay-mpl-1",
    partyId: "party-maple",
    date: getIsoDate(12),
    amount: 3200000,
    type: "received",
    mode: "bank",
    referenceNote: "Allied Bank Corporate Remittance",
    createdAt: getTs(12),
  },

  // DG Khan: Billed ~4,050,000 -> Paid 3,100,000 -> Due ~950,000
  {
    id: "pay-dgk-1",
    partyId: "party-dgkhan",
    date: getIsoDate(8),
    amount: 3100000,
    type: "received",
    mode: "bank",
    referenceNote: "Faysal Bank Online Transfer",
    createdAt: getTs(8),
  },

  // Fauji: Billed ~4,520,000 -> Paid 4,520,000 -> Settled (0 Due)
  {
    id: "pay-fji-1",
    partyId: "party-fauji",
    date: getIsoDate(4),
    amount: 4520000,
    type: "received",
    mode: "bank",
    referenceNote: "Askari Bank Corporate Transfer #7721",
    createdAt: getTs(4),
  },

  // Cherat: Billed ~4,850,000 -> Paid 5,500,000 -> Advance 650,000
  {
    id: "pay-cht-1",
    partyId: "party-cherat",
    date: getIsoDate(2),
    amount: 5500000,
    type: "received",
    mode: "bank",
    referenceNote: "Meezan Advance Coal Allocation #9011",
    createdAt: getTs(2),
  },

  // Kohat: Billed ~4,250,000 -> Paid 5,000,000 -> Advance 750,000
  {
    id: "pay-kht-1",
    partyId: "party-kohat",
    date: getIsoDate(1),
    amount: 5000000,
    type: "received",
    mode: "bank",
    referenceNote: "Bank of Khyber Advance Voucher",
    createdAt: getTs(1),
  },

  // Askari: Billed ~3,120,000 -> Paid 2,300,000 -> Due ~820,000
  {
    id: "pay-ask-1",
    partyId: "party-askari",
    date: getIsoDate(7),
    amount: 2300000,
    type: "received",
    mode: "cheque",
    referenceNote: "Askari Bank Cheque #4491",
    createdAt: getTs(7),
  },

  // Attock: Billed ~2,820,000 -> Paid 2,820,000 -> Settled (0 Due)
  {
    id: "pay-atk-1",
    partyId: "party-attock",
    date: getIsoDate(3),
    amount: 2820000,
    type: "received",
    mode: "bank",
    referenceNote: "Habib Metro Bank Transfer #1092",
    createdAt: getTs(3),
  },

  // Pioneer: Billed ~2,980,000 -> Paid 2,100,000 -> Due ~880,000
  {
    id: "pay-pnr-1",
    partyId: "party-pioneer",
    date: getIsoDate(6),
    amount: 2100000,
    type: "received",
    mode: "bank",
    referenceNote: "UBL Commercial Transfer",
    createdAt: getTs(6),
  },

  // Power Cement: Billed ~2,870,000 -> Paid 2,000,000 -> Due ~870,000
  {
    id: "pay-pwr-1",
    partyId: "party-power",
    date: getIsoDate(5),
    amount: 2000000,
    type: "received",
    mode: "bank",
    referenceNote: "JS Bank Transfer #5581",
    createdAt: getTs(5),
  },

  // Taj Wali: Billed ~2,520,000 -> Paid 3,100,000 -> Advance 580,000
  {
    id: "pay-tjw-1",
    partyId: "party-tajwali",
    date: getIsoDate(2),
    amount: 3100000,
    type: "received",
    mode: "cash",
    referenceNote: "Peshawar Yard Cash Advance Receipt #812",
    createdAt: getTs(2),
  },

  // Haji Bilal: Billed ~2,420,000 -> Paid 2,420,000 -> Settled (0 Due)
  {
    id: "pay-hjb-1",
    partyId: "party-hajibilal",
    date: getIsoDate(1),
    amount: 2420000,
    type: "received",
    mode: "bank",
    referenceNote: "Soneri Bank Online Clearing",
    createdAt: getTs(1),
  },

  // Duki Mines: Billed ~2,480,000 -> Paid 1,800,000 -> Due ~680,000
  {
    id: "pay-dkm-1",
    partyId: "party-duki",
    date: getIsoDate(4),
    amount: 1800000,
    type: "received",
    mode: "bank",
    referenceNote: "Al Baraka Pit Settlement Transfer",
    createdAt: getTs(4),
  },
];

export const INITIAL_SETTINGS: AppSettings = {
  userName: "Talha Awan",
  businessName: "Awan Coal Logistics",
  phoneNumber: "+92 300 8541290",
  logoUrl: "",
  theme: "light",
  currency: "PKR (Rs.)",
  companyAddress: "Suite 402, Coal Trading Tower, Industrial Area, Peshawar",
  ntnNumber: "NTN-4819022-7",
};

const DATA_VERSION_KEY = "coal_ledger_version";
const CURRENT_DATA_VERSION = "2026.10_pkr_v5_with_losses";

// Seed sample data if empty or outdated
function ensureSeeded() {
  const currentVersion = localStorage.getItem(DATA_VERSION_KEY);
  if (currentVersion !== CURRENT_DATA_VERSION) {
    // Migrate or reload to PKR sample data
    localStorage.setItem(PARTIES_KEY, JSON.stringify(INITIAL_PARTIES));
    localStorage.setItem(DISPATCHES_KEY, JSON.stringify(INITIAL_DISPATCHES));
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(INITIAL_PAYMENTS));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(INITIAL_SETTINGS));
    localStorage.setItem(POS_KEY, JSON.stringify(INITIAL_POS));
    localStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION);
    return;
  }

  if (!localStorage.getItem(PARTIES_KEY)) {
    localStorage.setItem(PARTIES_KEY, JSON.stringify(INITIAL_PARTIES));
  }
  if (!localStorage.getItem(DISPATCHES_KEY)) {
    localStorage.setItem(DISPATCHES_KEY, JSON.stringify(INITIAL_DISPATCHES));
  }
  if (!localStorage.getItem(PAYMENTS_KEY)) {
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(INITIAL_PAYMENTS));
  }
  if (!localStorage.getItem(SETTINGS_KEY)) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(INITIAL_SETTINGS));
  }
  if (!localStorage.getItem(POS_KEY)) {
    localStorage.setItem(POS_KEY, JSON.stringify(INITIAL_POS));
  }
}

// -- Dispatches --
export async function getDispatches(): Promise<Dispatch[]> {
  ensureSeeded();
  const data = localStorage.getItem(DISPATCHES_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function getDispatch(id: string): Promise<Dispatch | null> {
  const dispatches = await getDispatches();
  return dispatches.find((d) => d.id === id) || null;
}

export async function saveDispatch(dispatch: Dispatch): Promise<void> {
  const dispatches = await getDispatches();
  const existingIndex = dispatches.findIndex((d) => d.id === dispatch.id);

  if (existingIndex >= 0) {
    dispatches[existingIndex] = { ...dispatch, updatedAt: Date.now() };
  } else {
    dispatches.unshift({ ...dispatch, createdAt: Date.now(), updatedAt: Date.now() });
  }

  localStorage.setItem(DISPATCHES_KEY, JSON.stringify(dispatches));
}

export async function deleteDispatch(id: string): Promise<void> {
  const dispatches = await getDispatches();
  const filtered = dispatches.filter((d) => d.id !== id);
  localStorage.setItem(DISPATCHES_KEY, JSON.stringify(filtered));
}

// -- Payments --
export async function getPayments(): Promise<Payment[]> {
  ensureSeeded();
  const data = localStorage.getItem(PAYMENTS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function getPartyPayments(partyId: string): Promise<Payment[]> {
  const payments = await getPayments();
  return payments.filter((p) => p.partyId === partyId);
}

export async function savePayment(payment: Payment): Promise<void> {
  const payments = await getPayments();
  const existingIndex = payments.findIndex((p) => p.id === payment.id);

  if (existingIndex >= 0) {
    payments[existingIndex] = payment;
  } else {
    payments.unshift(payment);
  }

  localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
}

export async function deletePayment(id: string): Promise<void> {
  const payments = await getPayments();
  const filtered = payments.filter((p) => p.id !== id);
  localStorage.setItem(PAYMENTS_KEY, JSON.stringify(filtered));
}

// -- Parties --
export async function getParties(): Promise<Party[]> {
  ensureSeeded();
  const data = localStorage.getItem(PARTIES_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function getParty(id: string): Promise<Party | null> {
  const parties = await getParties();
  return parties.find((p) => p.id === id) || null;
}

export async function saveParty(party: Party): Promise<void> {
  const parties = await getParties();
  const existingIndex = parties.findIndex((p) => p.id === party.id);

  if (existingIndex >= 0) {
    parties[existingIndex] = party;
  } else {
    parties.unshift({ ...party, createdAt: Date.now() });
  }

  localStorage.setItem(PARTIES_KEY, JSON.stringify(parties));
}

export async function deleteParty(id: string): Promise<void> {
  const parties = await getParties();
  const filtered = parties.filter((p) => p.id !== id);
  localStorage.setItem(PARTIES_KEY, JSON.stringify(filtered));
}

// -- Purchase Orders --
export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  ensureSeeded();
  const data = localStorage.getItem(POS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
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
  const pos = await getPurchaseOrders();
  const existingIndex = pos.findIndex((p) => p.id === po.id);

  if (existingIndex >= 0) {
    pos[existingIndex] = po;
  } else {
    pos.unshift({ ...po, createdAt: Date.now() });
  }

  localStorage.setItem(POS_KEY, JSON.stringify(pos));
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  const pos = await getPurchaseOrders();
  const filtered = pos.filter((p) => p.id !== id);
  localStorage.setItem(POS_KEY, JSON.stringify(filtered));
}

// -- Settings --
export async function getSettings(): Promise<AppSettings> {
  ensureSeeded();
  const data = localStorage.getItem(SETTINGS_KEY);
  if (!data) return INITIAL_SETTINGS;
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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

export async function restoreBackup(backup: Partial<BackupPayload>): Promise<{ success: boolean; message: string; counts?: { parties: number; dispatches: number; payments: number; pos: number } }> {
  if (!backup || typeof backup !== 'object') {
    return { success: false, message: 'Invalid backup format' };
  }

  try {
    const parties = Array.isArray(backup.parties) ? backup.parties : [];
    const dispatches = Array.isArray(backup.dispatches) ? backup.dispatches : [];
    const payments = Array.isArray(backup.payments) ? backup.payments : [];
    const pos = Array.isArray(backup.pos) ? backup.pos : [];
    const settings = backup.settings && typeof backup.settings === 'object' ? backup.settings : INITIAL_SETTINGS;

    localStorage.setItem(PARTIES_KEY, JSON.stringify(parties));
    localStorage.setItem(DISPATCHES_KEY, JSON.stringify(dispatches));
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
    localStorage.setItem(POS_KEY, JSON.stringify(pos));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION);

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

// -- Reset & Demo helpers --
export async function resetToDemoData(): Promise<void> {
  localStorage.setItem(PARTIES_KEY, JSON.stringify(INITIAL_PARTIES));
  localStorage.setItem(DISPATCHES_KEY, JSON.stringify(INITIAL_DISPATCHES));
  localStorage.setItem(PAYMENTS_KEY, JSON.stringify(INITIAL_PAYMENTS));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(INITIAL_SETTINGS));
  localStorage.setItem(POS_KEY, JSON.stringify(INITIAL_POS));
  localStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION);
}

export async function clearAllData(): Promise<void> {
  localStorage.setItem(PARTIES_KEY, JSON.stringify([]));
  localStorage.setItem(DISPATCHES_KEY, JSON.stringify([]));
  localStorage.setItem(PAYMENTS_KEY, JSON.stringify([]));
  localStorage.setItem(POS_KEY, JSON.stringify([]));
  localStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION);
}

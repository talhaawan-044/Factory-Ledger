import { useState, useEffect, useMemo } from 'react';
import { getLots, saveLot, deleteLot, getDispatches, getSettings, getParties } from '../lib/db';
import type { InventoryLot, Dispatch, Party, AppSettings } from '../types';
import { calculateLotStock, calculateInventoryTotals, calculateLandedCost } from '../utils/calculations';
import { getCurrencySymbol, formatAmountNumber } from '../utils/currency';
import { playPopSound, playSuccessSound, triggerConfetti } from '../utils/delight';
import { useLedgerListener } from '../hooks/useLedgerListener';
import { v4 as uuidv4 } from 'uuid';
import {
  Package,
  Plus,
  Search,
  Trash2,
  Edit3,
  AlertTriangle,
  Scale,
  X,
  Calendar,
  Layers,
  Truck
} from 'lucide-react';
import FloatingField from '../components/FloatingField';
import IOSConfirmModal from '../components/IOSConfirmModal';

export default function Inventory() {
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [settings, setSettings] = useState<AppSettings | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low' | 'exhausted' | 'overdrawn'>('all');

  // Modal Sheet State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lotToDelete, setLotToDelete] = useState<InventoryLot | null>(null);
  const [selectedLotDetails, setSelectedLotDetails] = useState<InventoryLot | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const initialForm = {
    id: '',
    supplier: '',
    date: new Date().toISOString().split('T')[0],
    billedWeight: '',
    receivedWeight: '',
    purchaseRate: '',
    grade: '',
    targetGcv: '',
    notes: '',
  };
  const [form, setForm] = useState(initialForm);

  const curSym = getCurrencySymbol(settings?.currency);

  const loadData = async () => {
    const [l, d, p, s] = await Promise.all([
      getLots(),
      getDispatches(),
      getParties(),
      getSettings(),
    ]);
    setLots(l);
    setDispatches(d);
    setParties(p);
    setSettings(s);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useLedgerListener(() => {
    loadData();
  });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Derive global inventory metrics
  const totals = useMemo(() => {
    return calculateInventoryTotals(lots, dispatches);
  }, [lots, dispatches]);

  // Derive per-lot stock and metadata
  const lotCards = useMemo(() => {
    return lots.map((lot) => {
      const stock = calculateLotStock(lot, dispatches);
      const isOverdrawn = stock.isOverdrawn;
      const isExhausted = stock.remainingWeight <= 0 && !isOverdrawn;
      const isLow = stock.remainingWeight > 0 && stock.remainingWeight <= lot.receivedWeight * 0.15;

      let status: 'in_stock' | 'low' | 'exhausted' | 'overdrawn' = 'in_stock';
      if (isOverdrawn) status = 'overdrawn';
      else if (isExhausted) status = 'exhausted';
      else if (isLow) status = 'low';

      // Associated dispatches
      const linkedDispatches = dispatches.filter(
        (d) => !d.deleted && (d.coalInputs || []).some((ci) => ci.lotId === lot.id)
      );

      return {
        lot,
        stock,
        status,
        linkedDispatches,
      };
    });
  }, [lots, dispatches]);

  // Unique suppliers list for filter pill
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    lots.forEach((l) => {
      if (l.supplier?.trim()) set.add(l.supplier.trim());
    });
    return Array.from(set).sort();
  }, [lots]);

  // Filtered Cards
  const filteredLots = useMemo(() => {
    return lotCards.filter(({ lot, status }) => {
      if (supplierFilter !== 'all' && lot.supplier !== supplierFilter) {
        return false;
      }
      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSupplier = (lot.supplier || '').toLowerCase().includes(q);
        const matchGrade = (lot.grade || '').toLowerCase().includes(q);
        const matchNotes = (lot.notes || '').toLowerCase().includes(q);
        if (!matchSupplier && !matchGrade && !matchNotes) return false;
      }
      return true;
    });
  }, [lotCards, supplierFilter, statusFilter, searchQuery]);

  // Form Live Landed Cost Calculations
  const formBilledWeight = parseFloat(form.billedWeight) || 0;
  const formReceivedWeight = parseFloat(form.receivedWeight) || 0;
  const formPurchaseRate = parseFloat(form.purchaseRate) || 0;
  const formTotalCost = formBilledWeight * formPurchaseRate;
  const formLandedCalc = calculateLandedCost(formBilledWeight, formReceivedWeight, formPurchaseRate);
  const formLandedRate = formLandedCalc.landedRate;
  const formTransitDiff = formReceivedWeight > 0 && formBilledWeight > 0 ? formReceivedWeight - formBilledWeight : 0;

  const handleOpenAdd = () => {
    setForm({
      ...initialForm,
      date: new Date().toISOString().split('T')[0],
    });
    setIsModalOpen(true);
    playPopSound();
  };

  const handleOpenEdit = (lot: InventoryLot) => {
    setForm({
      id: lot.id,
      supplier: lot.supplier,
      date: lot.date || new Date().toISOString().split('T')[0],
      billedWeight: (lot.billedWeight || '').toString(),
      receivedWeight: (lot.receivedWeight || '').toString(),
      purchaseRate: (lot.purchaseRate || '').toString(),
      grade: lot.grade || '',
      targetGcv: lot.targetGcv ? lot.targetGcv.toString() : '',
      notes: lot.notes || '',
    });
    setIsModalOpen(true);
    playPopSound();
  };

  const handleSaveLot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier.trim()) {
      alert('Please enter supplier name.');
      return;
    }
    if (formBilledWeight <= 0) {
      alert('Please enter valid billed weight (tons).');
      return;
    }
    if (formReceivedWeight <= 0) {
      alert('Please enter valid received weight (tons).');
      return;
    }
    if (formPurchaseRate <= 0) {
      alert('Please enter valid purchase rate per ton.');
      return;
    }

    const lot: InventoryLot = {
      id: form.id || uuidv4(),
      supplier: form.supplier.trim(),
      date: form.date || new Date().toISOString().split('T')[0],
      billedWeight: formBilledWeight,
      receivedWeight: formReceivedWeight,
      purchaseRate: formPurchaseRate,
      landedRate: formLandedRate,
      grade: form.grade.trim() || undefined,
      targetGcv: parseFloat(form.targetGcv) || undefined,
      notes: form.notes.trim() || undefined,
      createdAt: form.id
        ? lots.find((l) => l.id === form.id)?.createdAt || Date.now()
        : Date.now(),
      updatedAt: Date.now(),
    };

    await saveLot(lot);
    playSuccessSound();
    triggerConfetti();
    setIsModalOpen(false);
    showToast(form.id ? 'Lot updated successfully' : 'Purchase lot added to inventory');
    await loadData();
  };

  const handleDeleteLot = async () => {
    if (!lotToDelete) return;
    await deleteLot(lotToDelete.id);
    playPopSound();
    showToast(`Deleted lot for ${lotToDelete.supplier}`);
    setLotToDelete(null);
    setSelectedLotDetails(null);
    await loadData();
  };

  return (
    <div className="ios-page-container">
      {/* ── Page Header ── */}
      <div className="ios-large-nav">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="ios-large-nav-title">Coal Inventory</h1>
            <p className="ios-large-nav-subtitle">
              Landed cost tracking & lot-level balance
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="ios-btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Add Lot</span>
          </button>
        </div>
      </div>

      {/* ── Top Key Metric Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
          padding: '0 16px 16px',
        }}
      >
        {/* Card 1: In Stock */}
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: 14,
            padding: '14px',
            border: '0.5px solid var(--separator)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--label-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            <Package size={14} style={{ color: 'var(--ios-blue)' }} /> Stock Left
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--label-primary)', marginTop: 6 }} className="tabular-nums">
            {totals.totalRemainingStock.toFixed(1)} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--label-secondary)' }}>tons</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--label-secondary)', marginTop: 4 }}>
            Active in yard
          </div>
        </div>

        {/* Card 2: Capital Tied Up */}
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: 14,
            padding: '14px',
            border: '0.5px solid var(--separator)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--label-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            <Scale size={14} style={{ color: 'var(--ios-green)' }} /> Capital Tied Up
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ios-green)', marginTop: 6 }} className="tabular-nums">
            {curSym} {formatAmountNumber(totals.totalCapitalTiedUp, settings)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--label-secondary)', marginTop: 4 }}>
            At derived landed cost
          </div>
        </div>

        {/* Card 3: Active Lots & Overdrawn warning */}
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: 14,
            padding: '14px',
            border: '0.5px solid var(--separator)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--label-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            <Layers size={14} style={{ color: totals.overdrawnLotsCount > 0 ? '#ff9500' : 'var(--label-secondary)' }} /> Active Lots
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--label-primary)', marginTop: 6 }} className="tabular-nums">
            {totals.totalActiveLots} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--label-secondary)' }}>lots</span>
          </div>
          <div style={{ fontSize: 11, color: totals.overdrawnLotsCount > 0 ? '#ff9500' : 'var(--label-secondary)', marginTop: 4, fontWeight: totals.overdrawnLotsCount > 0 ? 600 : 400 }}>
            {totals.overdrawnLotsCount > 0 ? `⚠️ ${totals.overdrawnLotsCount} overdrawn` : 'Stock balanced'}
          </div>
        </div>
      </div>

      {/* ── Search Bar & Filter Strip ── */}
      <div style={{ padding: '0 16px 12px' }}>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              color: 'var(--label-secondary)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by supplier, grade, remarks..."
            style={{
              width: '100%',
              padding: '9px 36px 9px 36px',
              borderRadius: 10,
              background: 'var(--fill-tertiary)',
              border: '0.5px solid var(--separator)',
              color: 'var(--label-primary)',
              fontSize: 14,
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: 10,
                background: 'none',
                border: 'none',
                color: 'var(--label-secondary)',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          <button
            onClick={() => setStatusFilter('all')}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: statusFilter === 'all' ? 'var(--ios-blue)' : 'var(--fill-primary)',
              color: statusFilter === 'all' ? 'white' : 'var(--label-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            All Lots ({lotCards.length})
          </button>
          <button
            onClick={() => setStatusFilter('in_stock')}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: statusFilter === 'in_stock' ? 'var(--ios-green)' : 'var(--fill-primary)',
              color: statusFilter === 'in_stock' ? 'white' : 'var(--label-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            In Stock
          </button>
          <button
            onClick={() => setStatusFilter('low')}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: statusFilter === 'low' ? '#ff9500' : 'var(--fill-primary)',
              color: statusFilter === 'low' ? 'white' : 'var(--label-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            Low Stock
          </button>
          <button
            onClick={() => setStatusFilter('overdrawn')}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: statusFilter === 'overdrawn' ? '#ff3b30' : 'var(--fill-primary)',
              color: statusFilter === 'overdrawn' ? 'white' : 'var(--label-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            Overdrawn ({totals.overdrawnLotsCount})
          </button>
          <button
            onClick={() => setStatusFilter('exhausted')}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: statusFilter === 'exhausted' ? 'var(--label-secondary)' : 'var(--fill-primary)',
              color: statusFilter === 'exhausted' ? 'white' : 'var(--label-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            Exhausted
          </button>
        </div>

        {/* Supplier Selector Pill if more than 1 supplier */}
        {uniqueSuppliers.length > 1 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingTop: 6, paddingBottom: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--label-secondary)', alignSelf: 'center', marginRight: 4 }}>
              Supplier:
            </span>
            <button
              onClick={() => setSupplierFilter('all')}
              style={{
                padding: '3px 10px',
                borderRadius: 14,
                border: '0.5px solid var(--separator)',
                fontSize: 11,
                cursor: 'pointer',
                background: supplierFilter === 'all' ? 'var(--label-primary)' : 'transparent',
                color: supplierFilter === 'all' ? 'var(--bg-primary)' : 'var(--label-secondary)',
              }}
            >
              All
            </button>
            {uniqueSuppliers.map((supp) => (
              <button
                key={supp}
                onClick={() => setSupplierFilter(supp)}
                style={{
                  padding: '3px 10px',
                  borderRadius: 14,
                  border: '0.5px solid var(--separator)',
                  fontSize: 11,
                  cursor: 'pointer',
                  background: supplierFilter === supp ? 'var(--label-primary)' : 'transparent',
                  color: supplierFilter === supp ? 'var(--bg-primary)' : 'var(--label-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {supp}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Inventory Lots List ── */}
      <div style={{ padding: '0 16px 80px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--label-secondary)' }}>
            Loading inventory lots…
          </div>
        ) : filteredLots.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 20px',
              background: 'var(--bg-card)',
              borderRadius: 16,
              border: '0.5px solid var(--separator)',
            }}
          >
            <Package size={44} style={{ color: 'var(--label-secondary)', margin: '0 auto 12px', opacity: 0.5 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-primary)' }}>
              No inventory lots found
            </div>
            <p style={{ fontSize: 13, color: 'var(--label-secondary)', marginTop: 4, maxWidth: 300, margin: '4px auto 16px' }}>
              Add a coal purchase lot with billed weight, received weight, and purchase rate to track landed cost and live auto-deductions.
            </p>
            <button
              onClick={handleOpenAdd}
              className="ios-btn-primary"
              style={{ padding: '8px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600 }}
            >
              + Add First Lot
            </button>
          </div>
        ) : (
          filteredLots.map(({ lot, stock, status, linkedDispatches }) => {
            const pctLeft = lot.receivedWeight > 0
              ? Math.max(0, Math.min(100, (stock.remainingWeight / lot.receivedWeight) * 100))
              : 0;

            const progressColor =
              status === 'overdrawn'
                ? '#ff3b30'
                : status === 'low'
                ? '#ff9500'
                : status === 'exhausted'
                ? 'var(--label-secondary)'
                : 'var(--ios-green)';

            return (
              <div
                key={lot.id}
                onClick={() => setSelectedLotDetails(lot)}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 16,
                  padding: '16px',
                  boxShadow: 'var(--shadow-card)',
                  border: '0.5px solid var(--separator)',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                {/* Header row: Supplier & Status Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--label-primary)' }}>
                        {lot.supplier}
                      </span>
                      {lot.grade && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            background: 'var(--fill-secondary)',
                            color: 'var(--label-primary)',
                            padding: '2px 8px',
                            borderRadius: 6,
                          }}
                        >
                          {lot.grade}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--label-secondary)', marginTop: 2 }}>
                      <Calendar size={12} /> {lot.date}
                      {lot.targetGcv && <span>· GCV: {lot.targetGcv}</span>}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {status === 'overdrawn' ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'white', background: '#ff3b30', padding: '3px 8px', borderRadius: 6 }}>
                        Overdrawn ({stock.remainingWeight.toFixed(1)}t)
                      </span>
                    ) : status === 'exhausted' ? (
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--label-secondary)', background: 'var(--fill-tertiary)', padding: '3px 8px', borderRadius: 6 }}>
                        Exhausted
                      </span>
                    ) : status === 'low' ? (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#ff9500', background: 'rgba(255, 149, 0, 0.15)', padding: '3px 8px', borderRadius: 6 }}>
                        Low Stock
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ios-green)', background: 'rgba(48, 209, 88, 0.15)', padding: '3px 8px', borderRadius: 6 }}>
                        In Stock
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Stock Gauge */}
                <div style={{ margin: '12px 0 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--label-primary)' }} className="tabular-nums">
                        {stock.remainingWeight.toFixed(1)}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--label-secondary)', marginLeft: 4 }}>
                        / {lot.receivedWeight} tons remaining
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-secondary)' }} className="tabular-nums">
                      {stock.dispatchedWeight.toFixed(1)}t dispatched
                    </div>
                  </div>

                  {/* Bar */}
                  <div
                    style={{
                      height: 8,
                      borderRadius: 4,
                      background: 'var(--fill-tertiary)',
                      overflow: 'hidden',
                      border: '0.5px solid var(--separator)',
                    }}
                  >
                    <div
                      style={{
                        width: `${pctLeft}%`,
                        height: '100%',
                        background: progressColor,
                        borderRadius: 4,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Overdrawn warning banner if applicable */}
                {stock.isOverdrawn && (
                  <div
                    style={{
                      background: 'rgba(255, 59, 48, 0.1)',
                      border: '0.5px solid rgba(255, 59, 48, 0.3)',
                      borderRadius: 8,
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      color: '#ff3b30',
                      marginBottom: 10,
                      fontWeight: 500,
                    }}
                  >
                    <AlertTriangle size={15} />
                    <span>Dispatches exceed received stock by {Math.abs(stock.remainingWeight).toFixed(1)} tons.</span>
                  </div>
                )}

                {/* Cost & Weights Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 8,
                    background: 'var(--fill-quaternary)',
                    borderRadius: 10,
                    padding: '10px',
                    fontSize: 12,
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--label-secondary)' }}>Billed Weight:</span>{' '}
                    <strong style={{ color: 'var(--label-primary)' }} className="tabular-nums">{lot.billedWeight}t</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--label-secondary)' }}>Purchase Rate:</span>{' '}
                    <strong style={{ color: 'var(--label-primary)' }} className="tabular-nums">{curSym} {lot.purchaseRate.toLocaleString()}/t</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--label-secondary)' }}>Transit Variance:</span>{' '}
                    <strong
                      style={{
                        color:
                          lot.receivedWeight < lot.billedWeight
                            ? '#ff3b30'
                            : lot.receivedWeight > lot.billedWeight
                            ? 'var(--ios-green)'
                            : 'var(--label-primary)',
                      }}
                      className="tabular-nums"
                    >
                      {(lot.receivedWeight - lot.billedWeight).toFixed(1)}t
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--label-secondary)' }}>Landed Cost Rate:</span>{' '}
                    <strong style={{ color: 'var(--ios-blue)', fontWeight: 700 }} className="tabular-nums">
                      {curSym} {lot.landedRate.toFixed(2)}/t
                    </strong>
                  </div>
                </div>

                {/* Footer with Linked Dispatches link & Quick Edit */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 10,
                    paddingTop: 8,
                    borderTop: '0.5px solid var(--separator)',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--label-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Truck size={12} />
                    <span>{linkedDispatches.length} dispatches blended</span>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(lot);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--ios-blue)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLotToDelete(lot);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ff3b30',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Add / Edit Lot Modal Sheet ── */}
      {isModalOpen && (
        <div className="ios-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div
            className="ios-modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Sheet Handle */}
            <div style={{ width: 36, height: 4, background: 'var(--fill-secondary)', borderRadius: 2, margin: '8px auto 16px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 12px' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--label-primary)' }}>
                {form.id ? 'Edit Purchase Lot' : 'New Purchase Lot'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'var(--fill-tertiary)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--label-secondary)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveLot} style={{ padding: '0 16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FloatingField
                label="Supplier Name"
                value={form.supplier}
                onChange={(val) => setForm({ ...form, supplier: val })}
                placeholder="e.g. Hashim Coal, Duki Traders"
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <FloatingField
                  label="Date"
                  type="date"
                  value={form.date}
                  onChange={(val) => setForm({ ...form, date: val })}
                />
                <FloatingField
                  label="Grade / Mine"
                  value={form.grade}
                  onChange={(val) => setForm({ ...form, grade: val })}
                  placeholder="e.g. Afghan 6000"
                />
              </div>

              <div className="ios-group">
                <div className="ios-group-title">Weights & Purchase Terms</div>
                <div style={{ padding: '0 16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <FloatingField
                      label="Billed Weight"
                      type="number"
                      step="0.01"
                      suffix="tons"
                      value={form.billedWeight}
                      onChange={(val) => setForm({ ...form, billedWeight: val })}
                      placeholder="e.g. 30"
                    />
                    <FloatingField
                      label="Received Weight"
                      type="number"
                      step="0.01"
                      suffix="tons"
                      value={form.receivedWeight}
                      onChange={(val) => setForm({ ...form, receivedWeight: val })}
                      placeholder="e.g. 28.5"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <FloatingField
                      label="Purchase Rate"
                      type="number"
                      suffix={`${curSym}/t`}
                      value={form.purchaseRate}
                      onChange={(val) => setForm({ ...form, purchaseRate: val })}
                      placeholder="e.g. 20000"
                    />
                    <FloatingField
                      label="Inbound GCV"
                      type="number"
                      suffix="kcal/kg"
                      value={form.targetGcv}
                      onChange={(val) => setForm({ ...form, targetGcv: val })}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>

              {/* ── Live Derived Landed Cost Card ── */}
              {formBilledWeight > 0 && formReceivedWeight > 0 && formPurchaseRate > 0 && (
                <div
                  style={{
                    background: 'var(--fill-quaternary)',
                    borderRadius: 14,
                    padding: '14px',
                    border: '0.5px solid var(--separator)',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ios-blue)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                    Derived Landed Cost Preview
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                    <div>
                      <span style={{ color: 'var(--label-secondary)' }}>Total Cost:</span>
                      <div style={{ fontWeight: 700, color: 'var(--label-primary)' }} className="tabular-nums">
                        {curSym} {formTotalCost.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--label-secondary)' }}>Transit Variance:</span>
                      <div
                        style={{
                          fontWeight: 700,
                          color: formTransitDiff < 0 ? '#ff3b30' : formTransitDiff > 0 ? 'var(--ios-green)' : 'var(--label-primary)',
                        }}
                        className="tabular-nums"
                      >
                        {formTransitDiff > 0 ? `+${formTransitDiff.toFixed(2)}` : formTransitDiff.toFixed(2)} tons
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 8,
                      borderTop: '0.5px solid var(--separator)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-primary)' }}>Effective Landed Rate</span>
                      <div style={{ fontSize: 11, color: 'var(--label-secondary)' }}>
                        ({curSym} {formTotalCost.toLocaleString()} ÷ {formReceivedWeight}t)
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ios-blue)' }} className="tabular-nums">
                      {curSym} {formLandedRate.toFixed(2)}/t
                    </div>
                  </div>
                </div>
              )}

              <FloatingField
                label="Challan / Truck / Remarks"
                value={form.notes}
                onChange={(val) => setForm({ ...form, notes: val })}
                placeholder="e.g. Truck TLK-492, Chamalang coal"
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: 12,
                    background: 'var(--fill-primary)',
                    color: 'var(--label-primary)',
                    border: 'none',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ios-btn-primary"
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {form.id ? 'Save Changes' : 'Add Purchase Lot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Lot Detail View Modal (Linked Dispatches breakdown) ── */}
      {selectedLotDetails && (
        <div className="ios-modal-backdrop" onClick={() => setSelectedLotDetails(null)}>
          <div
            className="ios-modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div style={{ width: 36, height: 4, background: 'var(--fill-secondary)', borderRadius: 2, margin: '8px auto 16px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 12px' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--label-primary)' }}>
                  {selectedLotDetails.supplier}
                </h2>
                <div style={{ fontSize: 12, color: 'var(--label-secondary)' }}>
                  Lot details & blend usage
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLotDetails(null)}
                style={{
                  background: 'var(--fill-tertiary)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--label-secondary)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '0 16px 20px' }}>
              {(() => {
                const stock = calculateLotStock(selectedLotDetails, dispatches);
                const linked = dispatches.filter(
                  (d) => !d.deleted && (d.coalInputs || []).some((ci) => ci.lotId === selectedLotDetails.id)
                );

                return (
                  <div>
                    {/* Summary row */}
                    <div
                      style={{
                        background: 'var(--fill-quaternary)',
                        borderRadius: 12,
                        padding: '12px',
                        marginBottom: 16,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 8,
                        textAlign: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--label-secondary)' }}>Received</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label-primary)' }}>
                          {selectedLotDetails.receivedWeight}t
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--label-secondary)' }}>Dispatched</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ios-blue)' }}>
                          {stock.dispatchedWeight.toFixed(1)}t
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--label-secondary)' }}>Remaining</div>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: stock.isOverdrawn ? '#ff3b30' : 'var(--ios-green)',
                          }}
                        >
                          {stock.remainingWeight.toFixed(1)}t
                        </div>
                      </div>
                    </div>

                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--label-primary)', marginBottom: 8 }}>
                      Dispatches Consuming This Lot ({linked.length})
                    </h3>

                    {linked.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--label-secondary)', padding: '12px 0' }}>
                        No dispatches have blended from this lot yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {linked.map((d) => {
                          const input = (d.coalInputs || []).find((ci) => ci.lotId === selectedLotDetails.id);
                          const inputWeight = input?.weight || 0;
                          const party = parties.find((p) => p.id === d.partyId);

                          return (
                            <div
                              key={d.id}
                              style={{
                                background: 'var(--bg-card)',
                                borderRadius: 10,
                                padding: '10px 12px',
                                border: '0.5px solid var(--separator)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--label-primary)' }}>
                                  {party?.name || d.factoryName || 'Factory'}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--label-secondary)' }}>
                                  {d.date} · Truck: {d.truckNumber || 'N/A'}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label-primary)' }} className="tabular-nums">
                                  {inputWeight.toFixed(1)} tons
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--label-secondary)' }}>
                                  blended
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                      <button
                        onClick={() => {
                          setSelectedLotDetails(null);
                          handleOpenEdit(selectedLotDetails);
                        }}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: 10,
                          background: 'var(--fill-primary)',
                          border: 'none',
                          color: 'var(--label-primary)',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Edit Lot
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      <IOSConfirmModal
        isOpen={Boolean(lotToDelete)}
        title="Delete Purchase Lot?"
        message={`Are you sure you want to delete the lot from ${lotToDelete?.supplier}? Any dispatches linked to this lot will retain their frozen purchase rate, but lot stock tracking will be removed.`}
        confirmText="Delete Lot"
        destructive
        countdownSeconds={0}
        onConfirm={handleDeleteLot}
        onCancel={() => setLotToDelete(null)}
      />

      {/* ── Toast ── */}
      {toastMsg && (
        <div className="ios-toast-banner">
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}

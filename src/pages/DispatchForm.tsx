import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  ChevronLeft,
  ChevronDown,
  Save,
  Trash2,
  AlertTriangle,
  ClipboardList,
  FileText,
  Layers,
  Receipt,
  TestTubes,
  SlidersHorizontal,
  AlignLeft,
  Calculator,
} from 'lucide-react';
import type { Dispatch, CoalInput, Party, PurchaseOrder } from '../types';
import { getDispatch, saveDispatch, deleteDispatch, getParties, getPartyPurchaseOrders, getDispatches } from '../lib/db';
import { calculateSettlement } from '../utils/calculations';
import { useParams, useNavigate, Link } from 'react-router-dom';
import IOSDatePicker from '../components/IOSDatePicker';
import IOSConfirmModal from '../components/IOSConfirmModal';
import { triggerConfetti, playSuccessSound, playPopSound } from '../utils/delight';

const defaultOverheads = {
  loading: 0,
  freight: 0,
  crush: 0,
  royalty: 0,
  other: 0,
};

const emptyDispatch: Omit<Dispatch, 'id' | 'createdAt' | 'updatedAt'> = {
  partyId: '',
  poId: '',
  date: new Date().toISOString().split('T')[0],
  truckNumber: '',
  factoryName: '',
  targetGcv: 0,
  baseRate: 0,
  commissionPerTon: 0,
  coalInputs: [
    { id: uuidv4(), sourceName: '', weight: 0, purchaseRate: 0 },
  ],
  overheads: defaultOverheads,
  labActualGcv: 0,
  labSulphur: 0,
  labAsh: 0,
  labVm: 0,
  labMoisture: 0,
  labReceivedWeight: 0,
  manualDeduction: 0,
  manualPremium: 0,
  manualTax: 0,
  taxMethod: 'manual',
  notes: '',
};

import FloatingField from '../components/FloatingField';

export default function DispatchForm() {
  const { partyId, dispatchId } = useParams<{ partyId: string; dispatchId: string }>();
  const navigate = useNavigate();

  const [dispatch, setDispatch] = useState<Omit<Dispatch, 'createdAt' | 'updatedAt'> | null>(() => {
    if (dispatchId === 'new') {
      return {
        ...emptyDispatch,
        id: uuidv4(),
        partyId: partyId || '',
      };
    }
    return null;
  });
  const [parties, setParties] = useState<Party[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [allDispatches, setAllDispatches] = useState<Dispatch[]>([]);
  const [isLoading, setIsLoading] = useState(() => dispatchId !== 'new');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    let active = true;
    getParties().then((p) => {
      if (active) setParties(p);
    });
    getDispatches().then((d) => {
      if (active) setAllDispatches(d);
    });

    const currentPartyId = partyId;
    if (currentPartyId) {
      getPartyPurchaseOrders(currentPartyId).then((orders) => {
        if (active) setPos(orders);
      });
    }

    if (dispatchId && dispatchId !== 'new') {
      getDispatch(dispatchId).then((data) => {
        if (!active) return;
        if (data) {
          const cleanDispatch: Omit<Dispatch, 'createdAt' | 'updatedAt'> = {
            ...emptyDispatch,
            ...data,
            coalInputs: Array.isArray(data.coalInputs) && data.coalInputs.length > 0
              ? data.coalInputs
              : [{ id: uuidv4(), sourceName: '', weight: 0, purchaseRate: 0 }],
            overheads: { ...defaultOverheads, ...(data.overheads || {}) },
          };
          setDispatch(cleanDispatch);
          if (cleanDispatch.partyId) {
            getPartyPurchaseOrders(cleanDispatch.partyId).then((orders) => {
              if (active) setPos(orders);
            });
          }
        }
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }

    return () => {
      active = false;
    };
  }, [dispatchId, partyId]);

  if (isLoading || !dispatch) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--label-secondary)', fontSize: 15 }}>
        Loading dispatch editor…
      </div>
    );
  }

  // Calculate live settlement
  const settlement = calculateSettlement(dispatch as Dispatch);
  const isProfit = settlement.netProfit >= 0;

  // Blend metrics
  const coalInputsList = dispatch.coalInputs || [];
  const totalInputWeight = coalInputsList.reduce((s, i) => s + (i.weight || 0), 0);
  const totalCoalCost = coalInputsList.reduce((s, i) => s + (i.weight || 0) * (i.purchaseRate || 0), 0);
  const avgCoalPurchaseRate = totalInputWeight > 0 ? totalCoalCost / totalInputWeight : 0;
  const transitWeightDiff = (dispatch.labReceivedWeight || 0) - totalInputWeight;

  // Pro-rata GCV Calculations
  const gcvDelta = dispatch.targetGcv && dispatch.labActualGcv ? dispatch.labActualGcv - dispatch.targetGcv : 0;
  const proRataDeduction = dispatch.targetGcv > 0 && dispatch.baseRate > 0 && dispatch.labActualGcv > 0 && dispatch.labActualGcv < dispatch.targetGcv
    ? Math.round(dispatch.baseRate * (1 - (dispatch.labActualGcv / dispatch.targetGcv)))
    : 0;
  const proRataPremium = dispatch.targetGcv > 0 && dispatch.baseRate > 0 && dispatch.labActualGcv > dispatch.targetGcv
    ? Math.round(dispatch.baseRate * ((dispatch.labActualGcv / dispatch.targetGcv) - 1))
    : 0;

  // Duplicate truck detection across all dispatches within 2 days
  const duplicateTruckInfo = (() => {
    if (!dispatch?.truckNumber?.trim()) return null;
    const cleanCurrentTruck = dispatch.truckNumber.trim().toUpperCase().replace(/[\s-]/g, '');
    if (cleanCurrentTruck.length < 3) return null;

    const match = allDispatches.find(d => {
      if (d.id === dispatch.id) return false;
      const cleanOther = (d.truckNumber || '').trim().toUpperCase().replace(/[\s-]/g, '');
      if (cleanOther !== cleanCurrentTruck) return false;
      const timeDiff = Math.abs(new Date(d.date).getTime() - new Date(dispatch.date).getTime());
      return timeDiff <= 2 * 86400000;
    });

    if (!match) return null;
    const matchParty = parties.find(p => p.id === match.partyId);
    return {
      date: match.date,
      partyName: matchParty?.name || match.factoryName || 'Factory',
      truckNumber: match.truckNumber
    };
  })();

  const handleSave = async () => {
    await saveDispatch(dispatch as Dispatch);
    playSuccessSound();
    triggerConfetti();
    navigate(`/parties/${dispatch.partyId || partyId}`);
  };

  const handleDelete = () => {
    playPopSound();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (dispatchId && dispatchId !== 'new') {
      await deleteDispatch(dispatchId);
      setShowDeleteConfirm(false);
      navigate(`/parties/${dispatch.partyId || partyId}`);
    }
  };

  const handleChange = (field: keyof typeof dispatch, value: any) => {
    setDispatch((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handlePartyChange = async (newPartyId: string) => {
    handleChange('partyId', newPartyId);
    const partyOrders = await getPartyPurchaseOrders(newPartyId);
    setPos(partyOrders);
    if (partyOrders.length > 0) {
      const activePo = partyOrders.find(p => p.isActive) || partyOrders[0];
      setDispatch(prev => prev ? {
        ...prev,
        partyId: newPartyId,
        poId: activePo.id,
        targetGcv: activePo.targetGcv || prev.targetGcv,
        baseRate: activePo.baseRate || prev.baseRate,
        commissionPerTon: activePo.commissionPerTon ?? prev.commissionPerTon,
      } : prev);
    } else {
      setDispatch(prev => prev ? { ...prev, partyId: newPartyId, poId: '' } : prev);
    }
  };

  const handlePOChange = (poId: string) => {
    const po = pos.find(p => p.id === poId);
    if (po) {
      setDispatch(prev => prev ? {
        ...prev,
        poId,
        targetGcv: po.targetGcv || prev.targetGcv,
        baseRate: po.baseRate || prev.baseRate,
        commissionPerTon: po.commissionPerTon ?? prev.commissionPerTon,
      } : prev);
    } else {
      setDispatch(prev => prev ? { ...prev, poId } : prev);
    }
  };

  const handleOverheadChange = (field: keyof typeof dispatch.overheads, value: number) => {
    setDispatch((prev) =>
      prev ? { ...prev, overheads: { ...prev.overheads, [field]: value } } : prev
    );
  };

  const addCoalInput = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDispatch((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        coalInputs: [
          ...prev.coalInputs,
          { id: uuidv4(), sourceName: '', weight: 0, purchaseRate: 0 },
        ],
      };
    });
  };

  const updateCoalInput = (id: string, field: keyof CoalInput, value: any) => {
    setDispatch((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        coalInputs: prev.coalInputs.map((input) =>
          input.id === id ? { ...input, [field]: value } : input
        ),
      };
    });
  };

  const removeCoalInput = (id: string) => {
    setDispatch((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        coalInputs: prev.coalInputs.filter((input) => input.id !== id),
      };
    });
  };

  return (
    <div className="ios-fade-in" style={{ paddingBottom: 32 }}>
      {/* ── Top Apple iOS Navigation Bar ── */}
      <div className="ios-navbar">
        <div className="ios-navbar-top-row">
          <Link to={`/parties/${dispatch.partyId || partyId}`} className="ios-back-button">
            <ChevronLeft style={{ width: 22, height: 22 }} strokeWidth={2.6} />
            <span>Ledger</span>
          </Link>
          <div className="ios-navbar-title-inline">
            {dispatchId === 'new' ? 'New Dispatch' : dispatch.truckNumber || 'Edit Dispatch'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={handleSave}
              className="ios-nav-action"
              style={{ fontWeight: 600, fontSize: 16 }}
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* ── Apple Card Floating Live Settlement Banner ── */}
      <div className="ios-hero-card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
              Live Calculated Profit
            </span>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: isProfit ? 'var(--ios-green)' : 'var(--ios-red)',
                lineHeight: 1.15,
                marginTop: 2,
              }}
              className="tabular-nums"
            >
              {isProfit ? '+' : ''}Rs. {Math.round(settlement.netProfit).toLocaleString('en-PK')}
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginTop: 14,
          paddingTop: 12,
          borderTop: '0.5px solid var(--separator)'
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--label-secondary)', textTransform: 'uppercase' }}>Payable Rate</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ios-blue)', marginTop: 1 }} className="tabular-nums">
              Rs. {settlement.payableRate.toFixed(2)}<span style={{ fontSize: 11, fontWeight: 400 }}>/t</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--label-secondary)', textTransform: 'uppercase' }}>Total Revenue</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label-primary)', marginTop: 1 }} className="tabular-nums">
              Rs. {Math.round(settlement.totalRevenue).toLocaleString('en-PK')}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 1: Dispatch General Info ── */}
      <div className="ios-group">
        <div className="ios-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ClipboardList size={16} /> Dispatch Details
        </div>
        <div style={{ padding: '0 16px' }}>
          {/* Party Picker */}
          <div className="floating-field is-floated" style={{ marginBottom: 12 }}>
            <select
              value={dispatch.partyId}
              onChange={(e) => handlePartyChange(e.target.value)}
              className="floating-input"
              style={{
                cursor: 'pointer',
                color: 'var(--label-primary)',
                fontWeight: 600,
                appearance: 'none',
                WebkitAppearance: 'none'
              }}
            >
              <option value="" disabled>Select Factory</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="floating-label" style={{ top: 0, transform: 'translateY(-50%)', fontSize: 12, fontWeight: 500, background: 'var(--bg-card)', color: 'var(--label-secondary)' }}>
              Factory
            </label>
          </div>

          {pos.length > 0 && (
            <div className="floating-field is-floated" style={{ marginBottom: 12 }}>
              <select
                value={dispatch.poId || ''}
                onChange={(e) => handlePOChange(e.target.value)}
                className="floating-input"
                style={{
                  cursor: 'pointer',
                  color: 'var(--label-primary)',
                  fontWeight: 600,
                  appearance: 'none',
                  WebkitAppearance: 'none'
                }}
              >
                <option value="" disabled>Select PO</option>
                {pos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.poNumber} (Base: {p.baseRate}, GCV: {p.targetGcv})
                  </option>
                ))}
              </select>
              <label className="floating-label" style={{ top: 0, transform: 'translateY(-50%)', fontSize: 12, fontWeight: 500, background: 'var(--bg-card)', color: 'var(--label-secondary)' }}>
                Purchase Order (PO)
              </label>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 10 }}>
            {/* Date */}
            <IOSDatePicker
              label="Dispatch Date"
              value={dispatch.date}
              onChange={(v) => handleChange('date', v)}
              floating
            />

            {/* Truck Number */}
            <FloatingField
              label="Truck Number"
              value={dispatch.truckNumber}
              onChange={(v) => handleChange('truckNumber', v.toUpperCase())}
              placeholder="e.g. TKX-418"
            />
          </div>

          {/* Duplicate Truck Warning Alert */}
          {duplicateTruckInfo && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 12px',
                borderRadius: 10,
                background: 'var(--tint-orange)',
                color: 'var(--ios-orange)',
                fontSize: 12,
                fontWeight: 600,
                marginTop: -4,
                marginBottom: 10
              }}
            >
              <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>
                Truck {duplicateTruckInfo.truckNumber} was already dispatched on {duplicateTruckInfo.date} to {duplicateTruckInfo.partyName}. Verify bilty to prevent duplicate billing.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Contract Parameters ── */}
      <div className="ios-group">
        <div className="ios-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={16} /> Contract Agreement Terms
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 16px' }}>
          <FloatingField
            label="Target GCV"
            type="number"
            value={dispatch.targetGcv || ''}
            onChange={(v) => handleChange('targetGcv', parseFloat(v) || 0)}
            placeholder="6000"
            suffix="kcal/kg"
          />
          <FloatingField
            label="Base Rate"
            type="number"
            value={dispatch.baseRate || ''}
            onChange={(v) => handleChange('baseRate', parseFloat(v) || 0)}
            placeholder="8500"
            suffix="Rs./t"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, padding: '0 16px' }}>
          <FloatingField
            label="Commission (deducted/t)"
            type="number"
            value={dispatch.commissionPerTon || ''}
            onChange={(v) => handleChange('commissionPerTon', parseFloat(v) || 0)}
            placeholder="0"
            suffix="Rs./t"
          />
        </div>
      </div>

      {/* ── Section 3: Coal Input Recipe & Blending ── */}
      <div className="ios-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 8px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
            <Layers size={16} /> Coal Blending Recipe ({dispatch.coalInputs.length})
          </span>
          <button
            onClick={addCoalInput}
            style={{
              background: 'var(--ios-blue)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Add Source
          </button>
        </div>

        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Live Coal Blend Multi-color Proportion Bar */}
          {dispatch.coalInputs.length > 1 && (() => {
            const totalBlendWeight = dispatch.coalInputs.reduce((sum, ci) => sum + (ci.weight || 0), 0);
            if (totalBlendWeight <= 0) return null;
            const blendPalette = ['#0A84FF', '#30D158', '#FF9F0A', '#BF5AF2', '#64D2FF'];
            return (
              <div style={{ padding: '0 4px 6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: 'var(--label-secondary)', marginBottom: 6 }}>
                  <span>Blend Proportions ({totalBlendWeight.toFixed(1)}t total sourced)</span>
                  <span>{dispatch.coalInputs.length} sources blended</span>
                </div>
                <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', background: 'var(--fill-tertiary)', border: '0.5px solid var(--separator)' }}>
                  {dispatch.coalInputs.map((ci, i) => {
                    const pct = totalBlendWeight > 0 ? ((ci.weight || 0) / totalBlendWeight) * 100 : 0;
                    if (pct <= 0) return null;
                    return (
                      <div
                        key={ci.id}
                        title={`${ci.sourceName || `Source ${i + 1}`}: ${pct.toFixed(1)}%`}
                        style={{
                          width: `${pct}%`,
                          background: blendPalette[i % blendPalette.length],
                          transition: 'width 0.3s ease'
                        }}
                      />
                    );
                  })}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                  {dispatch.coalInputs.map((ci, i) => {
                    const pct = totalBlendWeight > 0 ? (((ci.weight || 0) / totalBlendWeight) * 100).toFixed(0) : '0';
                    return (
                      <div key={ci.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--label-secondary)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: blendPalette[i % blendPalette.length] }} />
                        <span>{ci.sourceName || `Source ${i + 1}`} <strong>{pct}%</strong></span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {dispatch.coalInputs.map((input, idx) => {
            const rowCost = (input.weight || 0) * (input.purchaseRate || 0);

            return (
              <div
                key={input.id}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 16,
                  padding: '14px 14px 4px',
                  boxShadow: 'var(--shadow-card)',
                  border: '0.5px solid var(--separator)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-primary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    Source #{idx + 1}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--label-primary)' }} className="tabular-nums">
                      Rs. {Math.round(rowCost).toLocaleString('en-PK')}
                    </span>
                    {dispatch.coalInputs.length > 1 && (
                      <button
                        onClick={() => removeCoalInput(input.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--ios-red)',
                          padding: 4,
                          cursor: 'pointer',
                        }}
                        title="Remove source"
                      >
                        <Trash2 style={{ width: 15, height: 15 }} />
                      </button>
                    )}
                  </div>
                </div>

                <FloatingField
                  label="Coal Source / Grade"
                  value={input.sourceName}
                  onChange={(val) => updateCoalInput(input.id, 'sourceName', val)}
                  placeholder="e.g. Afghan 6000 or Duki Mine"
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <FloatingField
                    label="Weight"
                    type="number"
                    step="0.1"
                    suffix="tons"
                    value={input.weight || ''}
                    onChange={(val) => updateCoalInput(input.id, 'weight', parseFloat(val) || 0)}
                  />
                  <FloatingField
                    label="Buy Price"
                    type="number"
                    suffix="Rs./t"
                    value={input.purchaseRate || ''}
                    onChange={(val) => updateCoalInput(input.id, 'purchaseRate', parseFloat(val) || 0)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="ios-group-footnote" style={{ padding: '8px 18px 0' }}>
          Total Blend Weight: <strong>{totalInputWeight.toFixed(1)} tons</strong> · Avg Coal Purchase Rate: <strong>Rs. {Math.round(avgCoalPurchaseRate).toLocaleString('en-PK')}/t</strong>
        </div>
      </div>

      {/* ── Section 4: Overhead Expenses ── */}
      <div className="ios-group">
        <div className="ios-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Receipt size={16} /> Overhead Expenses
        </div>
        <div style={{ padding: '0 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FloatingField
              label="Loading Amnt"
              type="number"
              suffix="Rs."
              value={dispatch.overheads.loading || ''}
              onChange={(v) => handleOverheadChange('loading', parseFloat(v) || 0)}
            />
            <FloatingField
              label="Transport"
              type="number"
              suffix="Rs."
              value={dispatch.overheads.freight || ''}
              onChange={(v) => handleOverheadChange('freight', parseFloat(v) || 0)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FloatingField
              label="Crushing Amnt"
              type="number"
              suffix="Rs."
              value={dispatch.overheads.crush || ''}
              onChange={(v) => handleOverheadChange('crush', parseFloat(v) || 0)}
            />
            <FloatingField
              label="Royalty / Taxes"
              type="number"
              suffix="Rs."
              value={dispatch.overheads.royalty || ''}
              onChange={(v) => handleOverheadChange('royalty', parseFloat(v) || 0)}
            />
          </div>

          <FloatingField
            label="Other Expenses"
            type="number"
            suffix="Rs."
            value={dispatch.overheads.other || ''}
            onChange={(v) => handleOverheadChange('other', parseFloat(v) || 0)}
          />
        </div>
      </div>

      {/* ── Section 5: Factory Lab Results ── */}
      <div className="ios-group">
        <div className="ios-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TestTubes size={16} /> Factory Lab Test Results
        </div>
        <div style={{ padding: '0 16px' }}>
          {/* Caloric Quality Gauge Bar */}
          {Boolean(dispatch.targetGcv && dispatch.labActualGcv) && (() => {
            const ratio = (dispatch.labActualGcv / dispatch.targetGcv) * 100;
            const cappedPercent = Math.min(Math.max(ratio, 70), 130);
            const normalizedBar = ((cappedPercent - 70) / 60) * 100;
            const isSurplus = gcvDelta >= 0;
            const gaugeColor = isSurplus ? 'var(--ios-green)' : Math.abs(gcvDelta) <= 150 ? 'var(--ios-amber)' : 'var(--ios-red)';

            return (
              <div
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 14,
                  padding: '12px 14px',
                  marginBottom: 14,
                  border: '0.5px solid var(--separator)',
                  boxShadow: 'var(--shadow-card)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--label-secondary)', textTransform: 'uppercase' }}>
                      Caloric Compliance
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 10,
                        background: isSurplus ? 'var(--tint-green)' : 'var(--tint-red)',
                        color: isSurplus ? 'var(--ios-green)' : 'var(--ios-red)'
                      }}
                    >
                      {isSurplus ? 'Quality Bonus' : 'Caloric Deduction'}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: gaugeColor }} className="tabular-nums">
                    {gcvDelta >= 0 ? '+' : ''}{gcvDelta} kcal/kg ({ratio.toFixed(1)}%)
                  </span>
                </div>

                {/* Progress track */}
                <div style={{ position: 'relative', height: 10, background: 'var(--fill-tertiary)', borderRadius: 5, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${normalizedBar}%`,
                      background: gaugeColor,
                      borderRadius: 5,
                      transition: 'width 0.35s ease'
                    }}
                  />
                  {/* 100% target marker */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: 0,
                      bottom: 0,
                      width: 2,
                      background: 'var(--label-primary)',
                      opacity: 0.6,
                      zIndex: 2
                    }}
                    title="100% Target Contract GCV"
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--label-tertiary)', marginTop: 4 }}>
                  <span>Low GCV (-30%)</span>
                  <span style={{ fontWeight: 600, color: 'var(--label-secondary)' }}>Target: {dispatch.targetGcv} kcal</span>
                  <span>High GCV (+30%)</span>
                </div>
              </div>
            );
          })()}

          {totalInputWeight > 0 && (!dispatch.labReceivedWeight || dispatch.labReceivedWeight === 0) && (
            <div style={{ marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => handleChange('labReceivedWeight', parseFloat(totalInputWeight.toFixed(2)))}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--tint-blue)',
                  color: 'var(--ios-blue)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                Autofill Weighbridge Weight = Loaded Weight ({totalInputWeight.toFixed(2)}t)
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FloatingField
              label="Lab GCV"
              type="number"
              suffix="kcal/kg"
              value={dispatch.labActualGcv || ''}
              onChange={(v) => handleChange('labActualGcv', parseFloat(v) || 0)}
              placeholder="5950"
            />
            <FloatingField
              label="Rcvd Weight"
              type="number"
              step="0.01"
              suffix="tons"
              value={dispatch.labReceivedWeight || ''}
              onChange={(v) => handleChange('labReceivedWeight', parseFloat(v) || 0)}
              placeholder="39.5"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FloatingField
              label="Sulphur %"
              type="number"
              step="0.01"
              suffix="%"
              value={dispatch.labSulphur || ''}
              onChange={(v) => handleChange('labSulphur', parseFloat(v) || 0)}
              placeholder="4.10"
            />
            <FloatingField
              label="Ash %"
              type="number"
              step="0.01"
              suffix="%"
              value={dispatch.labAsh || ''}
              onChange={(v) => handleChange('labAsh', parseFloat(v) || 0)}
              placeholder="0.0"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FloatingField
              label="VM %"
              type="number"
              step="0.01"
              suffix="%"
              value={dispatch.labVm || ''}
              onChange={(v) => handleChange('labVm', parseFloat(v) || 0)}
              placeholder="0.0"
            />
            <FloatingField
              label="Moisture %"
              type="number"
              step="0.01"
              suffix="%"
              value={dispatch.labMoisture || ''}
              onChange={(v) => handleChange('labMoisture', parseFloat(v) || 0)}
              placeholder="0.0"
            />
          </div>

          {/* Warning pill if Sulphur is penalizable (> 4%) */}
          {dispatch.labSulphur > 4.0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              background: 'var(--tint-orange)',
              borderRadius: 12,
              marginTop: 4,
              color: 'var(--ios-orange)',
              fontSize: 13,
              fontWeight: 500
            }}>
              <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>
                Sulphur {dispatch.labSulphur}% exceeds 4.0% limit.
              </span>
            </div>
          )}

          {totalInputWeight > 0 && dispatch.labReceivedWeight > 0 && (
            <div className="ios-group-footnote" style={{ padding: '6px 4px 0' }}>
              Transit Shortage / Gain: <strong>{transitWeightDiff >= 0 ? '+' : ''}{transitWeightDiff.toFixed(2)} tons</strong> ({((transitWeightDiff / totalInputWeight) * 100).toFixed(1)}%)
            </div>
          )}
        </div>
      </div>

      {/* ── Section 5.5: Manual Adjustments ── */}
      <div className="ios-group">
        <div className="ios-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SlidersHorizontal size={16} /> Manual Adjustments
        </div>
        <div style={{ padding: '0 16px' }}>
          {/* Pro-Rata Quick-Fill Helper Buttons */}
          {(proRataDeduction > 0 || proRataPremium > 0) && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {proRataDeduction > 0 && (
                <button
                  type="button"
                  onClick={() => handleChange('manualDeduction', proRataDeduction)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--tint-red)',
                    color: 'var(--ios-red)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  Auto Pro-Rata GCV Deduction: Rs. {proRataDeduction}/t
                </button>
              )}
              {proRataPremium > 0 && (
                <button
                  type="button"
                  onClick={() => handleChange('manualPremium', proRataPremium)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--tint-green)',
                    color: 'var(--ios-green)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  Auto Pro-Rata GCV Premium: Rs. {proRataPremium}/t
                </button>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FloatingField
              label="Deduction"
              type="number"
              suffix="Rs./t"
              value={dispatch.manualDeduction || ''}
              onChange={(v) => handleChange('manualDeduction', parseFloat(v) || 0)}
              placeholder="0"
            />
            <FloatingField
              label="Premium"
              type="number"
              suffix="Rs./t"
              value={dispatch.manualPremium || ''}
              onChange={(v) => handleChange('manualPremium', parseFloat(v) || 0)}
              placeholder="0"
            />
          </div>
          {/* Tax Calculation Method */}
          <div className="floating-field is-floated" style={{ marginBottom: 12, position: 'relative' }}>
            <select
              value={dispatch.taxMethod || 'manual'}
              onChange={(e) => handleChange('taxMethod', e.target.value as 'manual' | 'formula_18_5')}
              className="floating-input"
              style={{
                cursor: 'pointer',
                color: 'var(--label-primary)',
                fontWeight: 600,
                appearance: 'none',
                WebkitAppearance: 'none',
                paddingRight: 36,
                background: 'transparent',
              }}
            >
              <option value="manual">Manual Entry</option>
              <option value="formula_18_5">Formula: (Rate + 18%) * 5%</option>
            </select>
            <label
              className="floating-label"
              style={{
                top: 0,
                transform: 'translateY(-50%)',
                fontSize: 12,
                fontWeight: 500,
                background: 'var(--bg-card)',
                color: 'var(--label-secondary)',
              }}
            >
              Tax Calculation Method
            </label>
            <div
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: 'var(--label-secondary)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChevronDown size={18} />
            </div>
          </div>

          {/* Dynamic UI: Manual Number Input or Read-Only Auto Formula Value */}
          {(dispatch.taxMethod || 'manual') === 'manual' ? (
            <FloatingField
              label="Tax Deduction"
              type="number"
              suffix="Rs./t"
              value={dispatch.manualTax || ''}
              onChange={(v) => handleChange('manualTax', parseFloat(v) || 0)}
              placeholder="0"
            />
          ) : (
            <div className="floating-field is-floated has-suffix" style={{ marginBottom: 12 }}>
              <input
                type="text"
                readOnly
                disabled
                value={settlement.taxDeduction.toFixed(2)}
                className="floating-input"
                style={{
                  color: 'var(--label-primary)',
                  fontWeight: 600,
                  cursor: 'not-allowed',
                  opacity: 0.9,
                  background: 'transparent',
                }}
              />
              <label
                className="floating-label"
                style={{
                  top: 0,
                  transform: 'translateY(-50%)',
                  fontSize: 12,
                  fontWeight: 500,
                  background: 'var(--bg-card)',
                  color: 'var(--label-secondary)',
                }}
              >
                Tax Deduction (Auto: (Rate + 18%) * 5%)
              </label>
              <span className="floating-suffix">Rs./t</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 5.6: Notes ── */}
      <div className="ios-group">
        <div className="ios-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlignLeft size={16} /> Notes
        </div>
        <div style={{ padding: '0 16px' }}>
          <textarea
            value={dispatch.notes || ''}
            onChange={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
              handleChange('notes', e.target.value);
            }}
            placeholder="Enter any specific notes..."
            style={{
              width: '100%',
              minHeight: '80px',
              marginBottom: '12px',
              padding: '12px',
              fontFamily: 'inherit',
              fontSize: '15px',
              border: '1px solid var(--separator)',
              borderRadius: '12px',
              background: 'var(--bg-card)',
              color: 'var(--label-primary)',
              resize: 'none',
              overflow: 'hidden',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* ── Section 6: Official Settlement Audit Breakdown ── */}
      <div className="ios-group">
        <div className="ios-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calculator size={16} /> Official Settlement Breakdown
        </div>
        <div className="ios-card-grouped" style={{ padding: '16px' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 8 }}>
            <span style={{ color: 'var(--label-secondary)' }}>Base Agreement Rate</span>
            <span style={{ fontWeight: 600 }} className="tabular-nums">Rs. {dispatch.baseRate.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 8, color: 'var(--ios-red)' }}>
            <span>- Manual Deduction</span>
            <span className="tabular-nums">- Rs. {settlement.gcvDeduction.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 8, color: 'var(--ios-green)' }}>
            <span>+ Manual Premium</span>
            <span className="tabular-nums">+ Rs. {(dispatch.manualPremium || 0).toFixed(2)}</span>
          </div>

          <div style={{ height: 0.5, background: 'var(--separator)', margin: '10px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>Adjusted Rate</span>
            <span style={{ fontWeight: 600 }} className="tabular-nums">Rs. {settlement.adjustedRate.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 8, color: 'var(--ios-red)' }}>
            <span>- Tax Deduction {dispatch.taxMethod === 'formula_18_5' ? '((Rate + 18%) × 5%)' : ''}</span>
            <span className="tabular-nums">- Rs. {settlement.taxDeduction.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 8 }}>
            <span style={{ color: 'var(--label-secondary)' }}>Net Rate</span>
            <span className="tabular-nums">Rs. {settlement.netRate.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 8, color: 'var(--ios-red)' }}>
            <span>- Commission</span>
            <span className="tabular-nums">- Rs. {(dispatch.commissionPerTon || 0).toFixed(2)}</span>
          </div>

          <div style={{ height: 0.5, background: 'var(--separator)', margin: '10px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, marginBottom: 12 }}>
            <span style={{ fontWeight: 700, color: 'var(--ios-blue)' }}>Payable Rate (per ton)</span>
            <span style={{ fontWeight: 700, color: 'var(--ios-blue)' }} className="tabular-nums">
              Rs. {settlement.payableRate.toFixed(2)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--label-secondary)', marginBottom: 6 }}>
            <span>Total Revenue ({dispatch.labReceivedWeight || 0} t × Rs. {settlement.payableRate.toFixed(2)})</span>
            <span className="tabular-nums">Rs. {Math.round(settlement.totalRevenue).toLocaleString('en-PK')}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--label-secondary)', marginBottom: 12 }}>
            <span>Total Cost (Coal + Overheads)</span>
            <span className="tabular-nums">Rs. {Math.round(settlement.totalCost).toLocaleString('en-PK')}</span>
          </div>

          <div style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: isProfit ? 'var(--ios-green)' : 'var(--ios-red)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: isProfit ? 'white' : 'red' }}>
              Final Net Profit
            </span>
            <span style={{ fontSize: 20, fontWeight: 800, color: isProfit ? 'white' : 'red' }} className="tabular-nums">
              {isProfit ? '+' : ''}Rs. {Math.round(settlement.netProfit).toLocaleString('en-PK')}
            </span>
          </div>

        </div>
      </div>

      {/* ── Bottom Action Buttons ── */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
        <button
          onClick={handleSave}
          className="ios-btn ios-btn-primary"
          style={{ width: '100%' }}
        >
          <Save style={{ width: 18, height: 18 }} strokeWidth={2.4} />
          <span>Save Dispatch</span>
        </button>

        {dispatchId !== 'new' && (
          <button
            onClick={handleDelete}
            className="ios-btn ios-btn-destructive"
            style={{ width: '100%', background: 'transparent' }}
          >
            <Trash2 style={{ width: 16, height: 16 }} />
            <span>Delete Dispatch Record</span>
          </button>
        )}
      </div>

      {/* ── iOS Liquid Glass Confirmation Modal ── */}
      <IOSConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Dispatch Record?"
        message={`Are you sure you want to delete this dispatch record${dispatch.truckNumber ? ` for truck ${dispatch.truckNumber}` : ''}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        countdownSeconds={2}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

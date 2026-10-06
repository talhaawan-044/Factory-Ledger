import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import IOSDatePicker from '../components/IOSDatePicker';
import {
  getParty,
  getDispatches,
  getPartyPayments,
  savePayment,
  deletePayment,
  getPartyPurchaseOrders,
  savePurchaseOrder,
  deletePurchaseOrder,
  saveParty,
  getSettings
} from '../lib/db';
import type { Party, Dispatch, Payment, PurchaseOrder, AppSettings } from '../types';
import { calculateSettlement, calculatePartyBalance } from '../utils/calculations';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { v4 as uuidv4 } from 'uuid';
import {
  ChevronLeft,
  Share2,
  ChevronRight,
  FileSpreadsheet,
  Truck,
  Coins,
  FileText,
  Edit2,
  Calculator,
  Trash2,
  Check,
  Copy,
  Loader2,
  Image,
  MessageSquare
} from 'lucide-react';
import PartyModalSheet from '../components/PartyModalSheet';
import FloatingField from '../components/FloatingField';
import { triggerConfetti, playSuccessSound, playPopSound, playCashChime } from '../utils/delight';
import { exportDispatchesPdf, exportDispatchesExcel, shareReceiptImage, sharePaymentImage } from '../utils/exportSharing';
import { DispatchReceipt } from '../components/DispatchReceipt';
import { PaymentReceipt } from '../components/PaymentReceipt';
import PartyGlyph from '../components/PartyGlyph';

export default function PartyLedger() {
  const { partyId } = useParams<{ partyId: string }>();
  const navigate = useNavigate();

  const [party, setParty] = useState<Party | null>(null);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter mode for transaction ledger
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'pos' | 'dispatches' | 'payments'>('all');

  // Feedback Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Share Statement Sheet state
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [isDispatchShareSheetOpen, setIsDispatchShareSheetOpen] = useState(false);

  // Add/Edit Payment Modal state
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState<{
    id?: string;
    date: string;
    amount: string;
    type: 'received' | 'paid';
    mode: 'bank' | 'cash' | 'cheque' | 'online';
    referenceNote: string;
  }>(() => ({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    type: 'received',
    mode: 'bank',
    referenceNote: ''
  }));

  // Add/Edit Purchase Order Modal state
  const [isAddingPO, setIsAddingPO] = useState(false);
  const [poForm, setPoForm] = useState<{
    id?: string;
    poNumber: string;
    targetGcv: string;
    baseRate: string;
    commissionPerTon: string;
    totalTons: string;
    notes: string;
    isActive: boolean;
  }>({
    poNumber: '',
    targetGcv: '6000',
    baseRate: '',
    commissionPerTon: '0',
    totalTons: '',
    notes: '',
    isActive: true
  });

  // Previews State
  const [previewDispatch, setPreviewDispatch] = useState<Dispatch | null>(null);
  const [previewPayment, setPreviewPayment] = useState<Payment | null>(null);
  const [previewPO, setPreviewPO] = useState<PurchaseOrder | null>(null);
  const [settings, setSettings] = useState<AppSettings | undefined>(undefined);
  const [isSharingDispatch, setIsSharingDispatch] = useState(false);
  const [isSharingPayment, setIsSharingPayment] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const paymentReceiptRef = useRef<HTMLDivElement>(null);

  // Edit Party Modal state
  const [isEditingParty, setIsEditingParty] = useState(false);

  const refreshLedger = useCallback(async () => {
    if (!partyId) return;
    const [p, allD, allPay, allPos, s] = await Promise.all([
      getParty(partyId),
      getDispatches(),
      getPartyPayments(partyId),
      getPartyPurchaseOrders(partyId),
      getSettings()
    ]);
    setParty(p);
    setDispatches(allD.filter((d) => d.partyId === partyId));
    setPayments(allPay);
    setPos(allPos);
    setSettings(s);
    setLoading(false);
  }, [partyId]);

  useEffect(() => {
    let isCurrent = true;
    if (partyId) {
      Promise.all([
        getParty(partyId),
        getDispatches(),
        getPartyPayments(partyId),
        getPartyPurchaseOrders(partyId),
        getSettings()
      ]).then(([p, allD, allPay, allPos, s]) => {
        if (isCurrent) {
          setParty(p);
          setDispatches(allD.filter((d) => d.partyId === partyId));
          setPayments(allPay);
          setPos(allPos);
          setSettings(s);
          setLoading(false);
        }
      });
    }
    return () => {
      isCurrent = false;
    };
  }, [partyId]);

  const handleShareDispatchImage = async () => {
    if (!previewDispatch || !receiptRef.current) return;
    setIsSharingDispatch(true);
    try {
      await shareReceiptImage(receiptRef.current, previewDispatch, party || undefined);
      playSuccessSound();
      showToast('Settlement receipt shared successfully!');
    } catch (err: any) {
      console.error('Share dispatch receipt error:', err);
      showToast('Failed to share receipt image.');
    } finally {
      setIsSharingDispatch(false);
    }
  };

  const handleShareDispatchWhatsApp = useCallback(async () => {
    if (!previewDispatch) return;

    const settlement = calculateSettlement(previewDispatch);
    const poObj = pos.find((p) => p.id === previewDispatch.poId);

    const text = `*${(settings?.businessName || 'AWAN COAL LOGISTICS').toUpperCase()}*
*OFFICIAL SETTLEMENT SLIP*
----------------------------------------
*Truck No:* ${previewDispatch.truckNumber}
*Date:* ${previewDispatch.date}
*Party:* ${party?.name || 'Factory Client'}
${poObj ? `*PO Number:* ${poObj.poNumber}\n` : ''}*Received Weight:* ${previewDispatch.labReceivedWeight || 0} Tons

*LAB ANALYSIS:*
• Target GCV: ${previewDispatch.targetGcv || 'N/A'} kcal/kg
• Actual GCV: ${previewDispatch.labActualGcv || 'N/A'} kcal/kg
• Ash / Moisture / Sulphur: ${previewDispatch.labAsh || 0}% / ${previewDispatch.labMoisture || 0}% / ${previewDispatch.labSulphur || 0}%

*RATE & SETTLEMENT CALCULATION:*
• Base Agreement Rate: Rs. ${previewDispatch.baseRate.toFixed(2)}/ton
• GCV Deduction: - Rs. ${settlement.gcvDeduction.toFixed(2)}/ton
${previewDispatch.manualPremium ? `• Premium: + Rs. ${previewDispatch.manualPremium.toFixed(2)}/ton\n` : ''}• Adjusted Rate: Rs. ${settlement.adjustedRate.toFixed(2)}/ton
• Tax Deduction: - Rs. ${settlement.taxDeduction.toFixed(2)}/ton
${previewDispatch.commissionPerTon ? `• Commission: - Rs. ${previewDispatch.commissionPerTon.toFixed(2)}/ton\n` : ''}----------------------------------------
*PAYABLE RATE:* Rs. ${settlement.payableRate.toFixed(2)} / ton
*TOTAL PAYABLE:* Rs. ${Math.round(settlement.totalRevenue).toLocaleString('en-PK')}
----------------------------------------
${previewDispatch.notes ? `*Remarks:* ${previewDispatch.notes}\n\n` : ''}✓ E-Verified Dispatch Voucher`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: `Dispatch Settlement - ${previewDispatch.truckNumber}`,
          text,
          dialogTitle: 'Share Settlement Slip',
        });
        playSuccessSound();
        showToast('Settlement slip shared!');
        return;
      } else if (navigator.share) {
        await navigator.share({
          title: `Dispatch Settlement - ${previewDispatch.truckNumber}`,
          text,
        });
        playSuccessSound();
        showToast('Settlement slip shared!');
        return;
      }
    } catch {
      // Ignored if cancelled
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      playPopSound();
      showToast('Settlement slip text copied to clipboard!');
    }
  }, [previewDispatch, party, pos, settings]);

  const handleSharePaymentVoucherImage = async (pay: Payment) => {
    if (!paymentReceiptRef.current) return;
    setIsSharingPayment(true);
    try {
      await sharePaymentImage(paymentReceiptRef.current, pay, party || undefined);
      playSuccessSound();
      showToast('Payment voucher picture shared!');
    } catch (err: any) {
      console.error('Share payment voucher error:', err);
      showToast('Failed to share payment voucher picture.');
    } finally {
      setIsSharingPayment(false);
    }
  };

  const handleSavePayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!partyId) return;
    const amt = parseFloat(paymentForm.amount);
    if (!amt || amt <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    const newPay: Payment = {
      id: paymentForm.id || uuidv4(),
      partyId,
      date: paymentForm.date || new Date().toISOString().split('T')[0],
      amount: amt,
      type: paymentForm.type,
      mode: paymentForm.mode,
      referenceNote: paymentForm.referenceNote.trim(),
      createdAt: paymentForm.id ? (payments.find(p => p.id === paymentForm.id)?.createdAt || Date.now()) : Date.now()
    };

    await savePayment(newPay);
    playCashChime();
    triggerConfetti();
    setIsAddingPayment(false);
    setPaymentForm({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      type: 'received',
      mode: 'bank',
      referenceNote: ''
    });
    showToast('Payment recorded successfully!');
    refreshLedger();
  };

  const handleDeletePayment = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this payment entry?')) {
      await deletePayment(id);
      setPreviewPayment(null);
      refreshLedger();
      showToast('Payment entry deleted');
    }
  };

  const handleSavePO = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!partyId || !poForm.poNumber.trim()) {
      alert('Please enter a PO Number');
      return;
    }

    const newPO: PurchaseOrder = {
      id: poForm.id || uuidv4(),
      partyId,
      poNumber: poForm.poNumber.trim().toUpperCase(),
      targetGcv: parseFloat(poForm.targetGcv) || 0,
      baseRate: parseFloat(poForm.baseRate) || 0,
      commissionPerTon: parseFloat(poForm.commissionPerTon) || 0,
      totalTons: parseFloat(poForm.totalTons) || undefined,
      notes: poForm.notes.trim() || undefined,
      isActive: poForm.isActive,
      createdAt: poForm.id ? (pos.find(p => p.id === poForm.id)?.createdAt || Date.now()) : Date.now()
    };

    await savePurchaseOrder(newPO);
    playSuccessSound();
    triggerConfetti();
    setIsAddingPO(false);
    setPreviewPO(null);
    refreshLedger();
    showToast(poForm.id ? 'Purchase Order updated!' : 'Purchase Order created!');
  };

  const handleDeletePO = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this Purchase Order? Related dispatches will remain in the database.')) {
      await deletePurchaseOrder(id);
      setPreviewPO(null);
      refreshLedger();
      showToast('Purchase Order deleted');
    }
  };

  const openNewPO = () => {
    const nextNum = (pos.length + 1).toString().padStart(3, '0');
    const prefix = party?.name?.split(' ')[0]?.toUpperCase() || 'COAL';
    setPoForm({
      id: undefined,
      poNumber: `PO-${prefix}-2026-${nextNum}`,
      targetGcv: '6000',
      baseRate: '38000',
      commissionPerTon: '500',
      totalTons: '',
      notes: '',
      isActive: true
    });
    setIsAddingPO(true);
  };

  const openEditPO = (po: PurchaseOrder) => {
    setPreviewPO(null);
    setPoForm({
      id: po.id,
      poNumber: po.poNumber,
      targetGcv: (po.targetGcv || '').toString(),
      baseRate: (po.baseRate || '').toString(),
      commissionPerTon: (po.commissionPerTon || '0').toString(),
      totalTons: (po.totalTons || '').toString(),
      notes: po.notes || '',
      isActive: po.isActive ?? true
    });
    setIsAddingPO(true);
  };

  const openPaymentEdit = (pay: Payment) => {
    setPreviewPayment(null);
    setPaymentForm({
      id: pay.id,
      date: pay.date,
      amount: pay.amount.toString(),
      type: pay.type,
      mode: pay.mode,
      referenceNote: pay.referenceNote || ''
    });
    setIsAddingPayment(true);
  };

  const openEditParty = () => {
    if (!party) return;
    setIsEditingParty(true);
  };

  // Financial aggregates derived directly during render via canonical calculatePartyBalance
  const partyBalance = calculatePartyBalance(dispatches, payments);
  const totalProfit = partyBalance.totalProfit;
  const totalBilled = partyBalance.totalBilled;
  const totalPaymentsReceived = partyBalance.totalPaymentsReceived;
  const netPaymentsReceived = partyBalance.netPaymentsReceived;
  const outstandingBalance = partyBalance.outstandingBalance;
  const totalTons = partyBalance.totalTons;
  const totalDeliveries = partyBalance.dispatchesCount;

  const handleCopyStatement = useCallback(async () => {
    const recentDisp = [...dispatches].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    const dateFormatted = new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

    const statementText = `*COAL ACCOUNT LEDGER STATEMENT*
*Party:* ${party?.name}
*Contact:* ${party?.contactPerson || 'Factory Account'} ${party?.phone ? `(${party?.phone})` : ''}
*Address:* ${party?.address || 'N/A'}
*Date:* ${dateFormatted}
----------------------------------------
*FINANCIAL OVERVIEW:*
• Total Shipments: ${totalDeliveries} trucks
• Total Dispatched Weight: ${totalTons.toFixed(2)} metric tons
• Total Billed Revenue: Rs. ${Math.round(totalBilled).toLocaleString('en-PK')}
• Net Payments Received: Rs. ${Math.round(netPaymentsReceived).toLocaleString('en-PK')}
----------------------------------------
*OUTSTANDING BALANCE:*
*Rs. ${Math.abs(outstandingBalance).toLocaleString('en-PK')}* (${outstandingBalance > 0 ? 'PAYABLE BY FACTORY' : outstandingBalance < 0 ? 'ADVANCE CREDIT HELD' : 'ACCOUNT FULLY SETTLED'})
----------------------------------------
*RECENT DELIVERIES:*
${recentDisp.map(d => `• ${d.truckNumber} (${d.date}): ${d.labReceivedWeight}t · Rs. ${Math.round(calculateSettlement(d).totalRevenue).toLocaleString('en-PK')}`).join('\n')}

*Generated by ${settings?.businessName || 'Awan Coal Logistics'}*`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: `Statement - ${party?.name}`,
          text: statementText,
          dialogTitle: 'Share Ledger Statement',
        });
        setIsShareSheetOpen(false);
        playSuccessSound();
        showToast('Statement shared!');
        return;
      } else if (navigator.share) {
        await navigator.share({
          title: `Statement - ${party?.name}`,
          text: statementText,
        });
        setIsShareSheetOpen(false);
        playSuccessSound();
        showToast('Statement shared!');
        return;
      }
    } catch {
      // Fallback to clipboard
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(statementText);
      setIsShareSheetOpen(false);
      playPopSound();
      showToast('Statement copied to clipboard!');
    }
  }, [party, dispatches, totalDeliveries, totalTons, totalBilled, netPaymentsReceived, outstandingBalance, settings]);

  const handleSharePaymentVoucher = useCallback(async (pay: Payment) => {
    const isReceived = pay.type === 'received';
    const text = `*OFFICIAL PAYMENT RECEIPT*
Receipt Ref: ${pay.id.slice(0, 8).toUpperCase()}
Date: ${pay.date}
Party: ${party?.name}
Amount: Rs. ${Math.round(pay.amount).toLocaleString('en-PK')}
Direction: ${isReceived ? 'PAYMENT RECEIVED (INFLOW)' : 'PAYMENT PAID (OUTFLOW)'}
Payment Mode: ${pay.mode.toUpperCase()}
Reference Note: ${pay.referenceNote || 'Direct Settlement'}
----------------------------------------
Current Ledger Balance: Rs. ${Math.abs(outstandingBalance).toLocaleString('en-PK')} (${outstandingBalance > 0 ? 'Receivable' : 'Settled'})

*${settings?.businessName || 'Awan Coal Logistics'}*`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: `Payment Receipt - ${party?.name}`,
          text,
          dialogTitle: 'Share Payment Receipt',
        });
        playSuccessSound();
        showToast('Payment receipt shared!');
        return;
      } else if (navigator.share) {
        await navigator.share({
          title: `Payment Receipt - ${party?.name}`,
          text,
        });
        playSuccessSound();
        showToast('Payment receipt shared!');
        return;
      }
    } catch {
      // Fallback
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      playPopSound();
      showToast('Payment voucher copied to clipboard!');
    }
  }, [party, outstandingBalance, settings]);

  // Unified chronological transactions list
  type LedgerItem =
    | { kind: 'dispatch'; data: Dispatch; date: string; time: number }
    | { kind: 'payment'; data: Payment; date: string; time: number }
    | { kind: 'po'; data: PurchaseOrder; date: string; time: number };

  const combinedLedger = useMemo(() => {
    const items: LedgerItem[] = [];

    if (ledgerFilter === 'all' || ledgerFilter === 'dispatches') {
      dispatches.forEach((d) => {
        items.push({
          kind: 'dispatch',
          data: d,
          date: d.date,
          time: new Date(d.date).getTime()
        });
      });
    }

    if (ledgerFilter === 'all' || ledgerFilter === 'payments') {
      payments.forEach((p) => {
        items.push({
          kind: 'payment',
          data: p,
          date: p.date,
          time: new Date(p.date).getTime()
        });
      });
    }

    if (ledgerFilter === 'all' || ledgerFilter === 'pos') {
      pos.forEach((p) => {
        const dateStr = new Date(p.createdAt).toISOString().split('T')[0];
        items.push({
          kind: 'po',
          data: p,
          date: dateStr,
          time: p.createdAt
        });
      });
    }

    return items.sort((a, b) => b.time - a.time);
  }, [dispatches, payments, pos, ledgerFilter]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--label-secondary)', fontSize: 15 }}>
        Loading ledger…
      </div>
    );
  }

  if (!party) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ios-red)', fontSize: 15 }}>
        Party account not found.
      </div>
    );
  }

  return (
    <div className="ios-fade-in" style={{ paddingBottom: 32 }}>
      {/* ── Toast Notification ── */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: 60,
          left: 20,
          right: 20,
          zIndex: 999999,
          background: 'rgba(28, 28, 30, 0.92)',
          color: '#FFFFFF',
          padding: '10px 16px',
          borderRadius: 20,
          fontSize: 14,
          fontWeight: 500,
          textAlign: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          animation: 'fadeIn 0.2s ease'
        }}>
          <Check style={{ width: 16, height: 16, color: 'var(--ios-green)' }} strokeWidth={3} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ── Top Apple iOS Navigation Bar ── */}
      <div className="ios-navbar">
        <div className="ios-navbar-top-row">
          <Link to="/parties" className="ios-back-button">
            <ChevronLeft style={{ width: 22, height: 22 }} strokeWidth={2.6} />
            <span>Factories</span>
          </Link>
          <div className="ios-navbar-title-inline">{party.name}</div>
          <button className="ios-nav-action" title="Share Statement" onClick={() => setIsShareSheetOpen(true)}>
            <Share2 style={{ width: 20, height: 20 }} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* ── Factory Profile & Action Buttons ── */}
      <div style={{ padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <PartyGlyph name={party.name} size={58} borderRadius={16} iconSize={28} />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--label-primary)', margin: 0 }}>
            {party.name}
          </h1>
          <div style={{ fontSize: 14, color: 'var(--label-secondary)', marginTop: 2 }}>
            {party.contactPerson || 'Factory Account'} {party.phone ? `· ${party.phone}` : ''}
          </div>
        </div>
        <button onClick={openEditParty} style={{ background: 'var(--fill-secondary)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-primary)', cursor: 'pointer' }}>
          <Edit2 style={{ width: 18, height: 18 }} strokeWidth={2} />
        </button>
      </div>

      {/* ── 3 Action Buttons ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '0 16px', marginBottom: 18 }}>
        <button
          onClick={() => { playPopSound(); navigate(`/parties/${partyId}/dispatch/new`); }}
          style={{
            padding: '13px 8px', borderRadius: 16,
            background: 'var(--ios-blue)',
            color: '#FFFFFF',
            border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: 'none',
            transition: 'transform 0.15s ease'
          }}
          className="ios-tile-btn interactive-scale"
        >
          <Truck style={{ width: 22, height: 22 }} strokeWidth={2.4} />
          <span>+ Dispatch</span>
        </button>

        <button
          onClick={() => {
            playPopSound();
            setPaymentForm({ id: undefined, date: new Date().toISOString().split('T')[0], amount: '', type: 'received', mode: 'bank', referenceNote: '' });
            setIsAddingPayment(true);
          }}
          style={{
            padding: '13px 8px', borderRadius: 16,
            background: 'var(--ios-green)',
            color: '#FFFFFF',
            border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: 'none',
            transition: 'transform 0.15s ease'
          }}
          className="ios-tile-btn interactive-scale"
        >
          <Coins style={{ width: 22, height: 22 }} strokeWidth={2.4} />
          <span>+ Payment</span>
        </button>

        <button
          onClick={() => { playPopSound(); openNewPO(); }}
          style={{
            padding: '13px 8px', borderRadius: 16,
            background: 'var(--ios-purple)',
            color: '#FFFFFF',
            border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: 'none',
            transition: 'transform 0.15s ease'
          }}
          className="ios-tile-btn interactive-scale"
        >
          <FileText style={{ width: 22, height: 22 }} strokeWidth={2.4} />
          <span>+ New PO</span>
        </button>
      </div>

      {/* ── Factory Dashboard Summary Card ── */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <div className="ios-hero-card" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Ledger Settlement Status
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: outstandingBalance <= 0 ? 'var(--ios-green)' : 'var(--ios-amber)',
                  background: outstandingBalance <= 0 ? 'var(--tint-green)' : 'var(--tint-amber)',
                  padding: '3px 10px',
                  borderRadius: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <span className="pulse-dot" style={{ background: outstandingBalance <= 0 ? 'var(--ios-green)' : 'var(--ios-amber)' }} />
                {outstandingBalance > 0 ? 'Dues Outstanding' : outstandingBalance < 0 ? 'Advance Credit Held' : 'Account Settled'}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 34,
                fontWeight: 800,
                color: outstandingBalance <= 0 ? 'var(--ios-green)' : 'var(--label-primary)',
                letterSpacing: '-0.02em',
                lineHeight: 1.15
              }}
              className="tabular-nums"
            >
              Rs. {Math.abs(outstandingBalance).toLocaleString('en-PK')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--label-secondary)', marginTop: 2, fontWeight: 500 }}>
              {outstandingBalance > 0
                ? 'Payable by Factory to Trader'
                : outstandingBalance < 0
                  ? 'Advance Deposit Available'
                  : 'All shipments and payments balanced'}
            </div>
          </div>

          {/* Metric grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 16 }}>
            <div className="ios-metric-widget">
              <span className="metric-label">Total Invoiced</span>
              <span className="metric-val" style={{ color: 'var(--label-primary)' }}>
                Rs. {Math.round(totalBilled).toLocaleString('en-PK')}
              </span>
            </div>
            <div className="ios-metric-widget">
              <span className="metric-label">Payments Received</span>
              <span className="metric-val" style={{ color: 'var(--ios-green)' }}>
                Rs. {Math.round(totalPaymentsReceived).toLocaleString('en-PK')}
              </span>
            </div>
            <div className="ios-metric-widget">
              <span className="metric-label">Delivered Volume</span>
              <span className="metric-val" style={{ color: 'var(--label-primary)' }}>
                {totalTons.toFixed(1)} <span style={{ fontSize: 13, fontWeight: 500 }}>t ({totalDeliveries} trucks)</span>
              </span>
            </div>
            <div className="ios-metric-widget">
              <span className="metric-label">Net Spread / Profit</span>
              <span className="metric-val" style={{ color: totalProfit >= 0 ? 'var(--ios-green)' : 'var(--ios-red)' }}>
                {totalProfit >= 0 ? '+' : ''}Rs. {Math.round(totalProfit).toLocaleString('en-PK')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Transaction History Filter Segment ── */}
      <div style={{ padding: '0 16px 14px', overflowX: 'auto', display: 'flex', scrollbarWidth: 'none' }}>
        <div className="ios-segmented" style={{ minWidth: 'min-content' }}>
          <button className={`ios-segmented-item ${ledgerFilter === 'all' ? 'active' : ''}`} onClick={() => { playPopSound(); setLedgerFilter('all'); }}>
            All ({combinedLedger.length})
          </button>
          <button className={`ios-segmented-item ${ledgerFilter === 'pos' ? 'active' : ''}`} onClick={() => { playPopSound(); setLedgerFilter('pos'); }}>
            POs ({pos.length})
          </button>
          <button className={`ios-segmented-item ${ledgerFilter === 'dispatches' ? 'active' : ''}`} onClick={() => { playPopSound(); setLedgerFilter('dispatches'); }}>
            Dispatches ({dispatches.length})
          </button>
          <button className={`ios-segmented-item ${ledgerFilter === 'payments' ? 'active' : ''}`} onClick={() => { playPopSound(); setLedgerFilter('payments'); }}>
            Payments ({payments.length})
          </button>
        </div>
      </div>

      {/* ── Combined Inset Grouped Ledger List ── */}
      <div className="ios-group">
        <div className="ios-card-grouped">
          {combinedLedger.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--label-secondary)' }}>
              <FileSpreadsheet style={{ width: 40, height: 40, margin: '0 auto 10px', opacity: 0.35 }} strokeWidth={1.5} />
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-primary)' }}>No Entries Yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Tap "+ Coal Entry" or "+ Payment Entry" above to add records.
              </div>
            </div>
          ) : (
            combinedLedger.map((item) => {
              const dateObj = new Date(item.date);
              const monthStr = dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
              const dayStr = dateObj.getDate();

              if (item.kind === 'dispatch') {
                const d = item.data;
                const settlement = calculateSettlement(d);
                const isProfit = settlement.netProfit >= 0;

                return (
                  <div key={`disp-${d.id}`} className="ios-cell" onClick={() => setPreviewDispatch(d)}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--fill-tertiary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginRight: 14, flexShrink: 0, border: '0.5px solid var(--separator)' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--ios-red)', letterSpacing: 0.3 }}>{monthStr}</span>
                      <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--label-primary)', lineHeight: 1 }}>{dayStr}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-primary)' }}>{d.truckNumber}</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--label-primary)' }} className="tabular-nums">Rs. {Math.round(settlement.totalRevenue).toLocaleString('en-PK')}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                        <span style={{ fontSize: 13, color: 'var(--label-secondary)' }}>{d.labReceivedWeight || 0} t</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: isProfit ? 'var(--ios-green)' : 'var(--ios-red)' }} className="tabular-nums">{isProfit ? '+' : ''}Rs. {Math.round(settlement.netProfit).toLocaleString('en-PK')} profit</span>
                      </div>
                    </div>
                    <ChevronRight className="ios-chevron" strokeWidth={2.5} />
                    <div className="ios-separator with-glyph" />
                  </div>
                );
              } else if (item.kind === 'payment') {
                const pay = item.data;
                const isReceived = pay.type === 'received';

                return (
                  <div key={`pay-${pay.id}`} className="ios-cell" onClick={() => setPreviewPayment(pay)} style={{ cursor: 'pointer' }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: isReceived ? 'var(--ios-green)' : 'var(--ios-orange)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 14,
                      flexShrink: 0
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255, 255, 255, 0.88)', letterSpacing: 0.3 }}>
                        {monthStr}
                      </span>
                      <span style={{ fontSize: 17, fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>
                        {dayStr}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-primary)' }}>{isReceived ? 'Payment Rcvd' : 'Payment Made'}</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: isReceived ? 'var(--ios-green)' : 'var(--label-primary)' }} className="tabular-nums">{isReceived ? '-' : '+'}Rs. {Math.round(pay.amount).toLocaleString('en-PK')}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                        <span style={{ fontSize: 13, color: 'var(--label-secondary)' }}>{pay.mode.toUpperCase()}{pay.referenceNote ? ` · ${pay.referenceNote}` : ''}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: isReceived ? 'white' : 'white', background: isReceived ? 'var(--ios-green)' : 'var(--ios-orange)', padding: '1px 6px', borderRadius: 4 }}>{isReceived ? 'RECEIVED' : 'PAID'}</span>
                      </div>
                    </div>
                    <ChevronRight className="ios-chevron" strokeWidth={2.5} />
                    <div className="ios-separator with-glyph" />
                  </div>
                );
              } else if (item.kind === 'po') {
                const po = item.data;
                const poDispatches = dispatches.filter(d => d.poId === po.id);
                const poTons = poDispatches.reduce((sum, d) => sum + (d.labReceivedWeight || 0), 0);
                const hasTarget = Boolean(po.totalTons && po.totalTons > 0);
                const progressPct = hasTarget ? Math.min(100, Math.round((poTons / (po.totalTons || 1)) * 100)) : 0;

                return (
                  <div key={`po-${po.id}`} className="ios-cell" onClick={() => setPreviewPO(po)} style={{ cursor: 'pointer' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: po.isActive ? 'rgba(175, 82, 222, 0.14)' : 'var(--fill-secondary)', color: po.isActive ? 'var(--ios-purple)' : 'var(--label-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14, flexShrink: 0 }}>
                      <FileText style={{ width: 22, height: 22 }} strokeWidth={2.2} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-primary)' }}>{po.poNumber}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: po.isActive ? 'var(--ios-green)' : 'var(--fill-secondary)', color: po.isActive ? 'white' : 'var(--label-tertiary)' }}>
                            {po.isActive ? 'ACTIVE' : 'FULFILLED'}
                          </span>
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--label-primary)' }} className="tabular-nums">Rs. {po.baseRate}/t</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                        <span style={{ fontSize: 13, color: 'var(--label-secondary)' }}>Target GCV: {po.targetGcv} · Comm: Rs. {po.commissionPerTon}/t</span>
                        <span style={{ fontSize: 12, color: hasTarget && progressPct >= 100 ? 'var(--ios-green)' : 'var(--label-tertiary)', fontWeight: hasTarget ? 600 : 400 }}>
                          {poDispatches.length} trucks ({poTons.toFixed(1)}{hasTarget ? ` / ${po.totalTons}t` : 't'})
                        </span>
                      </div>
                      {hasTarget && (
                        <div style={{ marginTop: 6, height: 5, borderRadius: 3, background: 'var(--fill-secondary)', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${progressPct}%`,
                              background: progressPct >= 100 ? 'var(--ios-green)' : 'var(--ios-purple)',
                              borderRadius: 3,
                              transition: 'width 0.3s ease'
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <ChevronRight className="ios-chevron" strokeWidth={2.5} />
                    <div className="ios-separator with-glyph" />
                  </div>
                );
              }
            })
          )}
        </div>
      </div>

      {/* Add Payment Native iOS Bottom Sheet Modal */}
      {isAddingPayment && (
        <>
          <div className="ios-modal-backdrop" onClick={() => setIsAddingPayment(false)} />
          <div className="ios-bottom-sheet">
            <div className="ios-sheet-handle" />
            <div className="ios-sheet-header">
              <button
                onClick={() => setIsAddingPayment(false)}
                className="ios-nav-action"
                style={{ fontWeight: 400 }}
              >
                Cancel
              </button>
              <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--label-primary)' }}>
                {paymentForm.id ? 'Edit Payment' : 'Record Payment'}
              </span>
              <button
                onClick={() => handleSavePayment()}
                disabled={!paymentForm.amount || parseFloat(paymentForm.amount) <= 0}
                className="ios-nav-action"
                style={{ fontWeight: 600 }}
              >
                Done
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="ios-sheet-body">
              <div className="ios-group" style={{ marginTop: 12 }}>
                <div className="ios-group-title">Payment Direction</div>
                <div className="ios-card-grouped" style={{ padding: 6 }}>
                  <div className="ios-segmented">
                    <button
                      type="button"
                      className={`ios-segmented-item ${paymentForm.type === 'received' ? 'active' : ''}`}
                      onClick={() => setPaymentForm({ ...paymentForm, type: 'received' })}
                    >
                      Payment Received (Inflow)
                    </button>
                    <button
                      type="button"
                      className={`ios-segmented-item ${paymentForm.type === 'paid' ? 'active' : ''}`}
                      onClick={() => setPaymentForm({ ...paymentForm, type: 'paid' })}
                    >
                      Payment Paid (Outflow)
                    </button>
                  </div>
                </div>
              </div>

              <div className="ios-group">
                <div className="ios-group-title">Payment Details</div>
                <div className="ios-card-grouped">
                  <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 17, color: 'var(--label-primary)' }}>Amount (PKR) *</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 17, color: 'var(--label-secondary)' }}>Rs.</span>
                      <input
                        required
                        type="number"
                        placeholder="0"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                        style={{ border: 'none', background: 'transparent', fontSize: 20, fontWeight: 600, textAlign: 'right', color: 'var(--label-primary)', outline: 'none', maxWidth: 160 }}
                        className="tabular-nums"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="ios-separator" />
                  <IOSDatePicker
                    label="Payment Date"
                    value={paymentForm.date}
                    onChange={(val) => setPaymentForm({ ...paymentForm, date: val })}
                    style={{ padding: '12px 16px' }}
                    inputStyle={{ textAlign: 'right', color: 'var(--ios-blue)' }}
                  />
                </div>
              </div>

              <div className="ios-group">
                <div className="ios-group-title">Payment Mode</div>
                <div className="ios-card-grouped" style={{ padding: 6 }}>
                  <div className="ios-segmented">
                    {(['bank', 'cash', 'cheque', 'online'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`ios-segmented-item ${paymentForm.mode === m ? 'active' : ''}`}
                        onClick={() => setPaymentForm({ ...paymentForm, mode: m })}
                      >
                        {m.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="ios-group">
                <div className="ios-group-title">Reference / Note</div>
                <div className="ios-card-grouped">
                  <div style={{ padding: '10px 16px' }}>
                    <input
                      type="text"
                      placeholder="e.g. Meezan Bank FT #884102 or Cheque number"
                      value={paymentForm.referenceNote}
                      onChange={(e) => setPaymentForm({ ...paymentForm, referenceNote: e.target.value })}
                      style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 16, color: 'var(--label-primary)', outline: 'none' }}
                    />
                  </div>
                </div>
                <div className="ios-group-footnote">
                  Recorded payments update the factory's ledger balance and payment receipts instantly.
                </div>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Edit Party Apple iOS Modal Sheet */}
      <PartyModalSheet
        isOpen={isEditingParty}
        mode="edit"
        initialData={party ? {
          name: party.name,
          contactPerson: party.contactPerson,
          phone: party.phone,
          address: party.address
        } : undefined}
        onClose={() => setIsEditingParty(false)}
        onSave={async (data) => {
          if (!party) return;
          const updatedParty: Party = {
            ...party,
            name: data.name,
            contactPerson: data.contactPerson,
            phone: data.phone,
            address: data.address
          };
          await saveParty(updatedParty);
          setParty(updatedParty);
          setIsEditingParty(false);
        }}
      />

      {/* ── PREVIEW: Dispatch ── */}
      {previewDispatch && (
        <>
          <div className="ios-modal-backdrop" onClick={() => { setPreviewDispatch(null); setIsDispatchShareSheetOpen(false); }} />
          <div className="ios-bottom-sheet" style={{ background: 'var(--bg-grouped)', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="ios-sheet-handle" />
            <div className="ios-sheet-header" style={{ borderBottom: '0.5px solid var(--separator)', padding: '10px 16px 12px', background: 'var(--bg-grouped)', flexShrink: 0 }}>
              <button onClick={() => { setPreviewDispatch(null); setIsDispatchShareSheetOpen(false); }} className="ios-nav-action" style={{ fontWeight: 400 }}>Close</button>
              <span style={{ fontSize: 17, fontWeight: 700 }}>Dispatch Preview</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsDispatchShareSheetOpen(true)}
                  disabled={isSharingDispatch}
                  className="ios-nav-action"
                  title="Share Receipt"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {isSharingDispatch ? (
                    <Loader2 style={{ width: 17, height: 17 }} className="animate-spin" />
                  ) : (
                    <Share2 style={{ width: 18, height: 18 }} strokeWidth={2.3} />
                  )}
                </button>
                <button onClick={() => navigate(`/parties/${partyId}/dispatch/${previewDispatch.id}`)} className="ios-nav-action" style={{ fontWeight: 600 }}>Edit</button>
              </div>
            </div>

            <div className="ios-sheet-body" style={{ flex: 1, overflowY: 'auto', padding: '16px 0 40px', background: 'var(--bg-grouped)' }}>

              {/* Prominent Share Action */}
              <div style={{ padding: '0 16px', marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => setIsDispatchShareSheetOpen(true)}
                  disabled={isSharingDispatch}
                  className="ios-btn ios-btn-primary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {isSharingDispatch ? (
                    <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
                  ) : (
                    <Share2 style={{ width: 18, height: 18 }} strokeWidth={2.4} />
                  )}
                  <span>Share Settlement Receipt</span>
                </button>
              </div>

              {/* Top Banner */}
              <div style={{ padding: '0 16px', marginBottom: 20 }}>
                <div style={{ background: 'var(--fill-secondary)', padding: 16, borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Truck Number</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--label-primary)', marginTop: 2 }}>{previewDispatch.truckNumber}</div>
                    <div style={{ fontSize: 14, color: 'var(--label-secondary)', marginTop: 4 }}>Date: {previewDispatch.date}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Net Profit</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: calculateSettlement(previewDispatch).netProfit >= 0 ? 'var(--ios-green)' : 'var(--ios-red)', marginTop: 2 }} className="tabular-nums">
                      {calculateSettlement(previewDispatch).netProfit >= 0 ? '+' : ''}Rs. {Math.round(calculateSettlement(previewDispatch).netProfit).toLocaleString('en-PK')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="ios-group">
                <div className="ios-group-title">Contract & Lab Results</div>
                <div className="ios-card-grouped" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 15 }}>
                    <span style={{ color: 'var(--label-secondary)' }}>Target GCV</span>
                    <span className="tabular-nums" style={{ fontWeight: 500 }}>{previewDispatch.targetGcv || 'N/A'} kcal/kg</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 15 }}>
                    <span style={{ color: 'var(--label-secondary)' }}>Actual GCV</span>
                    <span className="tabular-nums" style={{ fontWeight: 500 }}>{previewDispatch.labActualGcv || 'N/A'} kcal/kg</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 15 }}>
                    <span style={{ color: 'var(--label-secondary)' }}>Ash / Moisture / Sulphur</span>
                    <span className="tabular-nums" style={{ fontWeight: 500 }}>{previewDispatch.labAsh || 0}% / {previewDispatch.labMoisture || 0}% / {previewDispatch.labSulphur || 0}%</span>
                  </div>
                  <div className="ios-separator" style={{ margin: '12px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
                    <span style={{ color: 'var(--label-secondary)' }}>Received Weight</span>
                    <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--ios-blue)' }}>{previewDispatch.labReceivedWeight || 0} t</span>
                  </div>
                </div>
              </div>

              <div className="ios-group">
                <div className="ios-group-title">Coal Blending Sources</div>
                <div className="ios-card-grouped">
                  {previewDispatch.coalInputs.map((input, idx) => (
                    <div key={input.id}>
                      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--label-primary)' }}>{input.sourceName || 'Unknown Source'}</div>
                          <div style={{ fontSize: 13, color: 'var(--label-secondary)', marginTop: 2 }}>Purchase: Rs. {input.purchaseRate}/t</div>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--label-primary)' }}>
                          {input.weight} t
                        </div>
                      </div>
                      {idx < previewDispatch.coalInputs.length - 1 && <div className="ios-separator" />}
                    </div>
                  ))}
                  {(!previewDispatch.coalInputs || previewDispatch.coalInputs.length === 0) && (
                    <div style={{ padding: '12px 16px', color: 'var(--label-tertiary)', fontSize: 15, textAlign: 'center' }}>
                      No coal inputs recorded.
                    </div>
                  )}
                </div>
              </div>

              {(() => {
                const settlement = calculateSettlement(previewDispatch);
                const isProfit = settlement.netProfit >= 0;
                return (
                  <div className="ios-group">
                    <div className="ios-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calculator size={16} /> Official Settlement Breakdown
                    </div>
                    <div className="ios-card-grouped" style={{ padding: '16px' }}>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 8 }}>
                        <span style={{ color: 'var(--label-secondary)' }}>Base Agreement Rate</span>
                        <span style={{ fontWeight: 600 }} className="tabular-nums">Rs. {previewDispatch.baseRate.toFixed(2)}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 8, color: 'var(--ios-red)' }}>
                        <span>- Manual Deduction</span>
                        <span className="tabular-nums">- Rs. {settlement.gcvDeduction.toFixed(2)}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 8, color: 'var(--ios-green)' }}>
                        <span>+ Manual Premium</span>
                        <span className="tabular-nums">+ Rs. {(previewDispatch.manualPremium || 0).toFixed(2)}</span>
                      </div>

                      <div style={{ height: 0.5, background: 'var(--separator)', margin: '10px 0' }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 8 }}>
                        <span style={{ fontWeight: 600 }}>Adjusted Rate</span>
                        <span style={{ fontWeight: 600 }} className="tabular-nums">Rs. {settlement.adjustedRate.toFixed(2)}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 8, color: 'var(--ios-red)' }}>
                        <span>- Tax Deduction</span>
                        <span className="tabular-nums">- Rs. {settlement.taxDeduction.toFixed(2)}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 8 }}>
                        <span style={{ color: 'var(--label-secondary)' }}>Net Rate</span>
                        <span className="tabular-nums">Rs. {settlement.netRate.toFixed(2)}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 8, color: 'var(--ios-red)' }}>
                        <span>- Commission</span>
                        <span className="tabular-nums">- Rs. {(previewDispatch.commissionPerTon || 0).toFixed(2)}</span>
                      </div>

                      <div style={{ height: 0.5, background: 'var(--separator)', margin: '10px 0' }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, marginBottom: 12 }}>
                        <span style={{ fontWeight: 700, color: 'var(--ios-blue)' }}>Payable Rate (per ton)</span>
                        <span style={{ fontWeight: 700, color: 'var(--ios-blue)' }} className="tabular-nums">
                          Rs. {settlement.payableRate.toFixed(2)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--label-secondary)', marginBottom: 6 }}>
                        <span>Total Revenue ({previewDispatch.labReceivedWeight || 0} t × Rs. {settlement.payableRate.toFixed(2)})</span>
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
                        <span style={{ fontSize: 16, fontWeight: 700, color: isProfit ? 'white' : 'white' }}>
                          Final Net Profit
                        </span>
                        <span style={{ fontSize: 20, fontWeight: 800, color: isProfit ? 'white' : 'white' }} className="tabular-nums">
                          {isProfit ? '+' : ''}Rs. {Math.round(settlement.netProfit).toLocaleString('en-PK')}
                        </span>
                      </div>

                    </div>
                  </div>
                );
              })()}

              <div style={{ padding: '0 16px', marginTop: 10 }}>
                <button
                  onClick={() => navigate(`/parties/${partyId}/dispatch/${previewDispatch.id}`)}
                  className="ios-btn ios-btn-primary"
                  style={{ width: '100%', padding: 16, fontSize: 16, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Edit2 size={18} /> Edit Full Entry
                </button>
              </div>

            </div>
          </div>
        </>
      )}

      {/* ── Apple iOS Action Sheet for Dispatch Sharing ── */}
      {isDispatchShareSheetOpen && previewDispatch && (
        <>
          <div
            className="ios-modal-backdrop"
            onClick={() => setIsDispatchShareSheetOpen(false)}
            style={{ zIndex: 100000 }}
          />
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 100001,
              padding: '0 12px calc(14px + env(safe-area-inset-bottom, 14px))',
              maxWidth: 480,
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              animation: 'slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Action Sheet Group 1: Options */}
            <div
              style={{
                background: 'var(--bg-card)',
                borderRadius: 14,
                overflow: 'hidden',
                border: '0.5px solid var(--separator)',
                boxShadow: 'var(--shadow-elevated)'
              }}
            >
              {/* Action Sheet Header */}
              <div
                style={{
                  padding: '14px 16px 12px',
                  textAlign: 'center',
                  borderBottom: '0.5px solid var(--separator)',
                  background: 'var(--fill-quaternary)'
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Share Dispatch Receipt
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label-primary)', marginTop: 2 }}>
                  {previewDispatch.truckNumber} · {previewDispatch.date}
                </div>
              </div>

              {/* Option 1: Share as Image */}
              <button
                type="button"
                onClick={() => {
                  setIsDispatchShareSheetOpen(false);
                  handleShareDispatchImage();
                }}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '0.5px solid var(--separator)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  fontSize: 17,
                  fontWeight: 500,
                  color: 'var(--ios-blue)',
                  cursor: 'pointer'
                }}
              >
                <Image style={{ width: 20, height: 20 }} strokeWidth={2.2} />
                <span>Share as Picture (Official Receipt)</span>
              </button>

              {/* Option 2: Share Detailed WhatsApp Message */}
              <button
                type="button"
                onClick={() => {
                  setIsDispatchShareSheetOpen(false);
                  handleShareDispatchWhatsApp();
                }}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  fontSize: 17,
                  fontWeight: 500,
                  color: 'var(--ios-green)',
                  cursor: 'pointer'
                }}
              >
                <MessageSquare style={{ width: 20, height: 20 }} strokeWidth={2.2} />
                <span>Detailed WhatsApp Message</span>
              </button>
            </div>

            {/* Action Sheet Group 2: Cancel */}
            <button
              type="button"
              onClick={() => setIsDispatchShareSheetOpen(false)}
              style={{
                width: '100%',
                height: 56,
                background: 'var(--bg-card)',
                borderRadius: 14,
                border: '0.5px solid var(--separator)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--ios-blue)',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-card)'
              }}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* ── PREVIEW: Payment ── */}
      {previewPayment && (
        <>
          <div className="ios-modal-backdrop" onClick={() => setPreviewPayment(null)} />
          <div className="ios-bottom-sheet" style={{ background: 'var(--bg-card)', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <div className="ios-sheet-handle" />
            <div className="ios-sheet-header" style={{ borderBottom: '0.5px solid var(--separator)', padding: '10px 16px 12px' }}>
              <button onClick={() => setPreviewPayment(null)} className="ios-nav-action" style={{ fontWeight: 400 }}>Close</button>
              <span style={{ fontSize: 17, fontWeight: 700 }}>Payment Preview</span>
              <button onClick={() => openPaymentEdit(previewPayment)} className="ios-nav-action" style={{ fontWeight: 600 }}>Edit</button>
            </div>
            <div className="ios-sheet-body" style={{ padding: '20px 16px' }}>
              <div style={{ textAlign: 'center', margin: '20px 0 30px' }}>
                <div style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: '50%', background: previewPayment.type === 'received' ? 'var(--tint-green)' : 'var(--tint-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Coins style={{ color: previewPayment.type === 'received' ? 'var(--ios-green)' : 'var(--ios-orange)' }} size={32} />
                </div>
                <div style={{ fontSize: 14, color: 'var(--label-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                  {previewPayment.type === 'received' ? 'Received Amount' : 'Paid Amount'}
                </div>
                <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--label-primary)', margin: '8px 0' }}>
                  Rs. {Math.round(previewPayment.amount).toLocaleString('en-PK')}
                </div>
                <div style={{ fontSize: 15, color: 'var(--label-secondary)' }}>
                  {previewPayment.date} • {previewPayment.mode.toUpperCase()}
                </div>
                {previewPayment.referenceNote && (
                  <div style={{ fontSize: 14, color: 'var(--label-primary)', marginTop: 12, background: 'var(--fill-tertiary)', padding: '10px 16px', borderRadius: 12, display: 'inline-block' }}>
                    {previewPayment.referenceNote}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => handleSharePaymentVoucherImage(previewPayment)}
                  disabled={isSharingPayment}
                  className="ios-btn ios-btn-primary"
                  style={{ width: '100%', padding: 14, fontSize: 16, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {isSharingPayment ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Share2 size={18} />
                  )}
                  Share Official Voucher (Picture)
                </button>

                <button
                  type="button"
                  onClick={() => handleSharePaymentVoucher(previewPayment)}
                  className="ios-btn ios-btn-secondary"
                  style={{ width: '100%', padding: 14, fontSize: 15, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Copy size={16} /> Copy WhatsApp Text Statement
                </button>

                <button
                  onClick={(e) => handleDeletePayment(e, previewPayment.id)}
                  className="ios-btn ios-btn-destructive"
                  style={{ width: '100%', padding: 14, fontSize: 15, borderRadius: 14, background: 'var(--tint-red)', color: 'var(--ios-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Trash2 size={16} /> Delete Payment
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── PREVIEW: Purchase Order (PO) ── */}
      {previewPO && (
        <>
          <div className="ios-modal-backdrop" onClick={() => setPreviewPO(null)} />
          <div className="ios-bottom-sheet" style={{ background: 'var(--bg-grouped)', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="ios-sheet-handle" />
            <div className="ios-sheet-header" style={{ borderBottom: '0.5px solid var(--separator)', padding: '10px 16px 12px', background: 'var(--bg-grouped)', flexShrink: 0 }}>
              <button onClick={() => setPreviewPO(null)} className="ios-nav-action" style={{ fontWeight: 400 }}>Close</button>
              <span style={{ fontSize: 17, fontWeight: 700 }}>PO Contract Details</span>
              <button onClick={() => openEditPO(previewPO)} className="ios-nav-action" style={{ fontWeight: 600 }}>Edit</button>
            </div>

            <div className="ios-sheet-body" style={{ flex: 1, overflowY: 'auto', padding: '16px 0 40px', background: 'var(--bg-grouped)' }}>
              {(() => {
                const poDispatches = dispatches.filter(d => d.poId === previewPO.id);
                const fulfilledTons = poDispatches.reduce((sum, d) => sum + (d.labReceivedWeight || 0), 0);
                const poRevenue = poDispatches.reduce((sum, d) => sum + calculateSettlement(d).totalRevenue, 0);
                const hasTonnageTarget = Boolean(previewPO.totalTons && previewPO.totalTons > 0);
                const progressPct = hasTonnageTarget ? Math.min(100, Math.round((fulfilledTons / (previewPO.totalTons || 1)) * 100)) : 0;

                return (
                  <>
                    {/* Top Banner */}
                    <div style={{ padding: '0 16px', marginBottom: 18 }}>
                      <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 18, border: '0.5px solid var(--separator)', boxShadow: 'var(--shadow-card)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--label-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Purchase Order</span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: previewPO.isActive ? 'var(--ios-green)' : 'var(--fill-primary)', color: previewPO.isActive ? 'white' : 'var(--label-secondary)' }}>
                            {previewPO.isActive ? 'ACTIVE CONTRACT' : 'FULFILLED / CLOSED'}
                          </span>
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--label-primary)', marginTop: 4 }}>
                          {previewPO.poNumber}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--label-secondary)', marginTop: 2 }}>
                          Issued for {party.name} · Created {new Date(previewPO.createdAt).toLocaleDateString('en-PK')}
                        </div>

                        {hasTonnageTarget && (
                          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '0.5px solid var(--separator)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--label-secondary)', marginBottom: 6 }}>
                              <span>Fulfillment Progress</span>
                              <span style={{ fontWeight: 600, color: 'var(--label-primary)' }}>{fulfilledTons.toFixed(1)} / {previewPO.totalTons} tons ({progressPct}%)</span>
                            </div>
                            <div style={{ height: 8, background: 'var(--fill-primary)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--ios-purple)', borderRadius: 4 }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Contract Pricing & Terms */}
                    <div className="ios-group">
                      <div className="ios-group-title">Contract Agreement Terms</div>
                      <div className="ios-card-grouped" style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 10 }}>
                          <span style={{ color: 'var(--label-secondary)' }}>Base Agreement Rate</span>
                          <span style={{ fontWeight: 700, color: 'var(--ios-blue)' }} className="tabular-nums">Rs. {previewPO.baseRate.toLocaleString('en-PK')}/t</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 10 }}>
                          <span style={{ color: 'var(--label-secondary)' }}>Target Calorific Value (GCV)</span>
                          <span style={{ fontWeight: 600 }} className="tabular-nums">{previewPO.targetGcv} kcal/kg</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 10 }}>
                          <span style={{ color: 'var(--label-secondary)' }}>Commission Deduction</span>
                          <span style={{ fontWeight: 600 }} className="tabular-nums">Rs. {previewPO.commissionPerTon}/t</span>
                        </div>
                        {previewPO.totalTons && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
                            <span style={{ color: 'var(--label-secondary)' }}>Total Contract Tonnage</span>
                            <span style={{ fontWeight: 600 }} className="tabular-nums">{previewPO.totalTons} tons</span>
                          </div>
                        )}
                        {previewPO.notes && (
                          <>
                            <div className="ios-separator" style={{ margin: '10px 0' }} />
                            <div style={{ fontSize: 13, color: 'var(--label-secondary)' }}>
                              <strong>Notes:</strong> {previewPO.notes}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Fulfillment Performance */}
                    <div className="ios-group">
                      <div className="ios-group-title">Deliveries Under this PO ({poDispatches.length})</div>
                      <div className="ios-card-grouped">
                        {poDispatches.length === 0 ? (
                          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--label-tertiary)', fontSize: 14 }}>
                            No dispatches recorded against this PO yet.
                          </div>
                        ) : (
                          poDispatches.map((d, i) => {
                            const settl = calculateSettlement(d);
                            return (
                              <div
                                key={d.id}
                                className="ios-cell"
                                onClick={() => { setPreviewPO(null); setPreviewDispatch(d); }}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 15 }}>
                                    <span>{d.truckNumber}</span>
                                    <span className="tabular-nums">Rs. {Math.round(settl.totalRevenue).toLocaleString('en-PK')}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--label-secondary)', marginTop: 2 }}>
                                    <span>{d.labReceivedWeight} tons · Lab GCV: {d.labActualGcv}</span>
                                    <span>{d.date}</span>
                                  </div>
                                </div>
                                <ChevronRight className="ios-chevron" size={16} />
                                {i < poDispatches.length - 1 && <div className="ios-separator" />}
                              </div>
                            );
                          })
                        )}
                      </div>
                      {poDispatches.length > 0 && (
                        <div className="ios-group-footnote">
                          Total Delivered: <strong>{fulfilledTons.toFixed(1)} t</strong> · Total Billed: <strong>Rs. {Math.round(poRevenue).toLocaleString('en-PK')}</strong>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <button
                        onClick={() => {
                          setPreviewPO(null);
                          navigate(`/parties/${partyId}/dispatch/new`);
                        }}
                        className="ios-btn ios-btn-primary"
                        style={{ width: '100%', padding: 14, fontSize: 15, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      >
                        <Truck size={18} /> Record New Dispatch for this PO
                      </button>

                      <button
                        onClick={(e) => handleDeletePO(e, previewPO.id)}
                        className="ios-btn ios-btn-destructive"
                        style={{ width: '100%', padding: 14, fontSize: 15, borderRadius: 14, background: 'var(--tint-red)', color: 'var(--ios-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      >
                        <Trash2 size={16} /> Delete Purchase Order
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* ── ADD / EDIT PURCHASE ORDER MODAL ── */}
      {isAddingPO && (
        <>
          <div className="ios-modal-backdrop" onClick={() => setIsAddingPO(false)} style={{ zIndex: 99998 }} />
          <div className="ios-bottom-sheet" style={{ zIndex: 99999, background: 'var(--bg-grouped)', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="ios-sheet-handle" />
            <div className="ios-sheet-header" style={{ borderBottom: '0.5px solid var(--separator)', padding: '10px 16px 12px', background: 'var(--bg-grouped)' }}>
              <button onClick={() => setIsAddingPO(false)} className="ios-nav-action" style={{ fontWeight: 400 }}>Cancel</button>
              <span style={{ fontSize: 17, fontWeight: 600 }}>{poForm.id ? 'Edit Purchase Order' : 'New Purchase Order'}</span>
              <button onClick={() => handleSavePO()} disabled={!poForm.poNumber.trim()} className="ios-nav-action" style={{ fontWeight: 600 }}>Done</button>
            </div>

            <form onSubmit={handleSavePO} className="ios-sheet-body" style={{ padding: '16px 0 40px', overflowY: 'auto' }}>
              <div className="ios-group" style={{ marginTop: 0 }}>
                <div className="ios-group-title">PO Identifier & Status</div>
                <div style={{ padding: '0 16px' }}>
                  <FloatingField
                    label="PO Number *"
                    value={poForm.poNumber}
                    onChange={(val) => setPoForm({ ...poForm, poNumber: val.toUpperCase() })}
                    placeholder="e.g. PO-BW-2026-002"
                    required
                    autoFocus
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--separator)', marginTop: 4 }}>
                    <span style={{ fontSize: 16, color: 'var(--label-primary)' }}>Contract Status</span>
                    <button
                      type="button"
                      onClick={() => setPoForm({ ...poForm, isActive: !poForm.isActive })}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 16,
                        border: 'none',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: poForm.isActive ? 'var(--ios-green)' : 'var(--fill-primary)',
                        color: poForm.isActive ? 'white' : 'var(--label-secondary)'
                      }}
                    >
                      {poForm.isActive ? 'Active Contract' : 'Fulfilled / Closed'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="ios-group">
                <div className="ios-group-title">Rate & Target Specifications</div>
                <div style={{ padding: '0 16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <FloatingField
                      label="Target GCV"
                      type="number"
                      suffix="kcal/kg"
                      value={poForm.targetGcv}
                      onChange={(val) => setPoForm({ ...poForm, targetGcv: val })}
                      placeholder="6000"
                    />
                    <FloatingField
                      label="Base Rate"
                      type="number"
                      suffix="Rs./t"
                      value={poForm.baseRate}
                      onChange={(val) => setPoForm({ ...poForm, baseRate: val })}
                      placeholder="38500"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <FloatingField
                      label="Commission"
                      type="number"
                      suffix="Rs./t"
                      value={poForm.commissionPerTon}
                      onChange={(val) => setPoForm({ ...poForm, commissionPerTon: val })}
                      placeholder="500"
                    />
                    <FloatingField
                      label="Target Tonnage"
                      type="number"
                      suffix="tons"
                      value={poForm.totalTons}
                      onChange={(val) => setPoForm({ ...poForm, totalTons: val })}
                      placeholder="Optional"
                    />
                  </div>

                  <FloatingField
                    label="Contract Remarks / Notes"
                    value={poForm.notes}
                    onChange={(val) => setPoForm({ ...poForm, notes: val })}
                    placeholder="e.g. Max Sulphur 4.2%, Ash < 12%"
                  />
                </div>
                <div className="ios-group-footnote" style={{ padding: '6px 18px 0' }}>
                  When dispatching trucks, selecting this PO will auto-populate target GCV, base rate, and commission.
                </div>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── SHARE ACCOUNT STATEMENT ACTION SHEET ── */}
      {isShareSheetOpen && (
        <>
          <div className="ios-modal-backdrop" onClick={() => setIsShareSheetOpen(false)} style={{ zIndex: 99998 }} />
          <div className="ios-bottom-sheet" style={{ zIndex: 99999, background: 'var(--bg-grouped)', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <div className="ios-sheet-handle" />
            <div className="ios-sheet-header" style={{ borderBottom: '0.5px solid var(--separator)', padding: '12px 16px', background: 'var(--bg-grouped)' }}>
              <span style={{ fontSize: 17, fontWeight: 700, margin: '0 auto' }}>Share Account Statement</span>
            </div>

            <div style={{ padding: '16px 16px 36px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '0.5px solid var(--separator)', padding: '16px', marginBottom: 6 }}>
                <div style={{ fontSize: 13, color: 'var(--label-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Recipient</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--label-primary)', marginTop: 2 }}>{party.name}</div>
                <div style={{ fontSize: 14, color: 'var(--label-secondary)', marginTop: 2 }}>
                  Net Balance: <strong style={{ color: outstandingBalance > 0 ? 'var(--label-primary)' : 'var(--ios-green)' }}>Rs. {Math.abs(outstandingBalance).toLocaleString('en-PK')}</strong> ({outstandingBalance > 0 ? 'Receivable' : 'Settled'})
                </div>
              </div>

              <button
                onClick={handleCopyStatement}
                className="ios-btn ios-btn-primary"
                style={{ width: '100%', padding: 15, fontSize: 16, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
              >
                <Copy size={18} /> Copy WhatsApp Formatted Statement
              </button>

              <button
                onClick={async () => {
                  try {
                    await exportDispatchesPdf({
                      party: party || undefined,
                      partyName: party.name,
                      title: `${party.name.toUpperCase()} - STATEMENT OF ACCOUNT`,
                      dispatches,
                      payments,
                      parties: party ? [party] : [],
                      pos,
                      settings: settings || undefined,
                    });
                    playSuccessSound();
                    setIsShareSheetOpen(false);
                    showToast('PDF Statement ready to share!');
                  } catch (err) {
                    console.error('PDF export failed:', err);
                  }
                }}
                className="ios-btn"
                style={{
                  width: '100%',
                  padding: 15,
                  fontSize: 16,
                  borderRadius: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#DC2626',
                  fontWeight: 600,
                  border: '0.5px solid rgba(239, 68, 68, 0.25)',
                }}
              >
                <FileText size={18} /> Export as PDF Statement
              </button>

              <button
                onClick={async () => {
                  try {
                    await exportDispatchesExcel({
                      party: party || undefined,
                      partyName: party.name,
                      dispatches,
                      payments,
                      parties: party ? [party] : [],
                      pos,
                      settings: settings || undefined,
                    });
                    playSuccessSound();
                    setIsShareSheetOpen(false);
                    showToast('Excel Spreadsheet ready to share!');
                  } catch (err) {
                    console.error('Excel export failed:', err);
                  }
                }}
                className="ios-btn ios-btn-secondary"
                style={{ width: '100%', padding: 15, fontSize: 16, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
              >
                <FileSpreadsheet size={18} /> Export as Excel (.xlsx)
              </button>

              <button
                onClick={() => setIsShareSheetOpen(false)}
                className="ios-btn"
                style={{ width: '100%', padding: 14, fontSize: 16, borderRadius: 14, background: 'var(--fill-primary)', color: 'var(--label-primary)', marginTop: 4 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Hidden Off-Screen Component for High-Quality Image Receipt Generation */}
      {previewDispatch && (
        <div
          style={{
            position: 'fixed',
            left: -9999,
            top: 0,
            opacity: 1,
            pointerEvents: 'none',
            zIndex: -999,
          }}
          aria-hidden="true"
        >
          <DispatchReceipt
            ref={receiptRef}
            dispatch={previewDispatch}
            party={party || undefined}
            po={pos.find((p) => p.id === previewDispatch.poId)}
            settings={settings}
          />
        </div>
      )}

      {/* Off-screen Payment Receipt for HTML2Canvas */}
      {previewPayment && (
        <div
          style={{
            position: 'fixed',
            left: -9999,
            top: 0,
            opacity: 1,
            pointerEvents: 'none',
            zIndex: -999,
          }}
          aria-hidden="true"
        >
          <PaymentReceipt
            ref={paymentReceiptRef}
            payment={previewPayment}
            party={party || undefined}
            settings={settings}
            currentBalance={outstandingBalance}
          />
        </div>
      )}

    </div>
  );
}

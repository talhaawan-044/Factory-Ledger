import { useEffect, useState, useRef } from 'react';
import { getDispatches, getParties, getPayments, getPurchaseOrders, getSettings } from '../lib/db';
import type { Dispatch, Party, Payment, PurchaseOrder, AppSettings } from '../types';
import { calculateSettlement, calculatePartyBalance } from '../utils/calculations';
import { playPopSound, triggerConfetti, playSuccessSound } from '../utils/delight';
import {
    Truck,
    Building2,
    ChevronRight,
    ArrowUpRight,
    Flame,
    Scale,
    TrendingUp,
    Share2,
    Loader2,
    CheckCircle2,
    Calculator,
    Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DispatchReceipt } from '../components/DispatchReceipt';
import { shareReceiptImage } from '../utils/exportSharing';
import DealEstimatorModal from '../components/DealEstimatorModal';

export default function Summary() {
    const [dispatches, setDispatches] = useState<Dispatch[]>([]);
    const [parties, setParties] = useState<Party[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [pos, setPos] = useState<PurchaseOrder[]>([]);
    const [settings, setSettings] = useState<AppSettings | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<'all' | 'month' | '30days'>('all');
    const [previewDispatch, setPreviewDispatch] = useState<Dispatch | null>(null);
    const [isSharingDispatch, setIsSharingDispatch] = useState(false);
    const [isEstimatorOpen, setIsEstimatorOpen] = useState(false);
    const [toastMsg, setToastMsg] = useState<string | null>(null);
    const receiptRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 2500);
    };

    // Lazy initialization for today's date & timestamps (ensuring zero purity warnings)
    const [todayStr] = useState(() =>
        new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        }).toUpperCase()
    );

    const [nowInfo] = useState(() => {
        const now = new Date();
        return {
            monthPrefix: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
            thirtyDaysAgo: now.getTime() - 30 * 86400000
        };
    });

    useEffect(() => {
        Promise.all([getDispatches(), getParties(), getPayments(), getPurchaseOrders(), getSettings()]).then(([d, p, pay, poList, s]) => {
            setDispatches(d);
            setParties(p);
            setPayments(pay);
            setPos(poList);
            setSettings(s);
            setLoading(false);
        });
    }, []);

    const handleShareDispatchImage = async () => {
        if (!previewDispatch || !receiptRef.current) return;
        setIsSharingDispatch(true);
        try {
            const party = parties.find(p => p.id === previewDispatch.partyId);
            await shareReceiptImage(receiptRef.current, previewDispatch, party);
            playSuccessSound();
            showToast('Settlement receipt shared successfully!');
        } catch (err: any) {
            console.error('Share dispatch receipt error:', err);
            showToast('Failed to share receipt image.');
        } finally {
            setIsSharingDispatch(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--label-secondary)', fontSize: 15 }}>
                Loading overview…
            </div>
        );
    }

    // Filter dispatches based on selected period
    const filteredDispatches = dispatches.filter(d => {
        if (period === 'month') {
            return d.date?.startsWith(nowInfo.monthPrefix) || d.createdAt >= new Date(nowInfo.monthPrefix + '-01').getTime();
        }
        if (period === '30days') {
            return d.createdAt >= nowInfo.thirtyDaysAgo;
        }
        return true;
    });

    // Calculations based on filtered dispatches
    const totalProfit = filteredDispatches.reduce((sum, d) => sum + calculateSettlement(d).netProfit, 0);
    const totalRevenue = filteredDispatches.reduce((sum, d) => sum + calculateSettlement(d).totalRevenue, 0);
    const totalCost = filteredDispatches.reduce((sum, d) => sum + calculateSettlement(d).totalCost, 0);
    const totalTons = filteredDispatches.reduce((sum, d) => sum + (d.labReceivedWeight || 0), 0);
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const formattedProfit = `${totalProfit >= 0 ? '+' : ''}Rs.\u00A0${Math.round(totalProfit).toLocaleString('en-PK')}`;

    // Recent Dispatches
    const recentDispatches = [...filteredDispatches]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5);

    const partyBalances = parties.map(party => {
        const pDispatches = dispatches.filter(d => d.partyId === party.id);
        const pPayments = payments.filter(p => p.partyId === party.id);
        const balanceResult = calculatePartyBalance(pDispatches, pPayments);
        return { party, balance: balanceResult.outstandingBalance, dispatchesCount: pDispatches.length };
    });

    const totalReceivables = partyBalances.reduce((sum, pb) => pb.balance > 0 ? sum + pb.balance : sum, 0);
    const partiesWithDues = partyBalances.filter(pb => pb.balance > 0);

    // Coal Sourcing & Blend breakdown
    const sourceMap: { [name: string]: { totalTons: number; totalCost: number; count: number } } = {};
    filteredDispatches.forEach(d => {
        d.coalInputs?.forEach(c => {
            const name = (c.sourceName || 'Unspecified').trim();
            if (!sourceMap[name]) {
                sourceMap[name] = { totalTons: 0, totalCost: 0, count: 0 };
            }
            const weight = Number(c.weight) || 0;
            const rate = Number(c.purchaseRate) || 0;
            sourceMap[name].totalTons += weight;
            sourceMap[name].totalCost += weight * rate;
            sourceMap[name].count += 1;
        });
    });

    const coalSourcesSummary = Object.entries(sourceMap)
        .map(([name, data]) => ({
            name,
            totalTons: data.totalTons,
            totalCost: data.totalCost,
            avgRate: data.totalTons > 0 ? Math.round(data.totalCost / data.totalTons) : 0,
            count: data.count
        }))
        .sort((a, b) => b.totalTons - a.totalTons);

    const firstName = settings?.userName?.trim().split(/\s+/)[0] || '';

    return (
        <div className="ios-fade-in" style={{ paddingBottom: 24 }}>
            {/* ── iOS Navigation Header with Large Title ── */}
            <div className="ios-large-header">
                <div className="ios-large-subtitle">{todayStr}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h1 className="ios-large-title">{firstName ? `Welcome ${firstName}` : 'Welcome'}</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                            type="button"
                            onClick={() => {
                                playPopSound();
                                setIsEstimatorOpen(true);
                            }}
                            className="ios-nav-circle-btn"
                            title="Quick Deal Estimator & Margin Calculator"
                        >
                            <Calculator style={{ width: 19, height: 19 }} strokeWidth={2.4} />
                        </button>
                        <button
                            onClick={() => {
                                playPopSound();
                                if (parties.length > 0) {
                                    navigate(`/parties/${parties[0].id}/dispatch/new`);
                                } else {
                                    navigate('/parties');
                                }
                            }}
                            className="ios-nav-circle-btn"
                            title="New Dispatch"
                        >
                            <Plus style={{ width: 20, height: 20 }} strokeWidth={2.6} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Period Selector (Segmented Control) ── */}
            <div style={{ padding: '0 16px', marginBottom: 14 }}>
                <div className="ios-segmented">
                    <button
                        type="button"
                        className={`ios-segmented-item ${period === 'all' ? 'active' : ''}`}
                        onClick={() => {
                            setPeriod('all');
                            playPopSound();
                        }}
                    >
                        All Time
                    </button>
                    <button
                        type="button"
                        className={`ios-segmented-item ${period === 'month' ? 'active' : ''}`}
                        onClick={() => {
                            setPeriod('month');
                            playPopSound();
                        }}
                    >
                        This Month
                    </button>
                    <button
                        type="button"
                        className={`ios-segmented-item ${period === '30days' ? 'active' : ''}`}
                        onClick={() => {
                            setPeriod('30days');
                            playPopSound();
                        }}
                    >
                        Last 30 Days
                    </button>
                </div>
            </div>

            {/* ── Apple Wallet / Fitness Hero Card: Net Profit ── */}
            <div className="ios-hero-card">
                {/* Header row: Metric Title + Period Indicator on Left, Margin Badge on Right */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
                            Total Profit
                        </span>
                        {period !== 'all' && (
                            <span style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: 6,
                                background: 'var(--accent-tint)',
                                color: 'var(--accent-primary)',
                                textTransform: 'uppercase',
                                letterSpacing: 0.3,
                                whiteSpace: 'nowrap'
                            }}>
                                {period === 'month' ? 'This Month' : 'Last 30d'}
                            </span>
                        )}
                    </div>

                    {/* Celebratory interactive margin badge */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            triggerConfetti(e.clientX, e.clientY);
                        }}
                        className="ios-hero-badge"
                        title="Click for celebration!"
                        style={{ border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                        <ArrowUpRight style={{ width: 14, height: 14, flexShrink: 0 }} strokeWidth={2.6} />
                        <span style={{ whiteSpace: 'nowrap' }}>{profitMargin.toFixed(1)}% margin</span>
                    </button>
                </div>

                {/* Hero Amount: Dedicated full width, guaranteed single line */}
                <div
                    style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: formattedProfit.length > 15 ? 28 : formattedProfit.length > 12 ? 34 : 38,
                        fontWeight: 800,
                        letterSpacing: -1,
                        color: totalProfit >= 0 ? 'var(--ios-green)' : 'var(--ios-red)',
                        lineHeight: 1.15,
                        marginTop: 8,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}
                    className="tabular-nums"
                >
                    {formattedProfit}
                </div>

                {/* Visual Multi-Segment Comparison Progress Bar */}
                <div style={{ marginTop: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--label-secondary)', marginBottom: 7, fontWeight: 500 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Scale style={{ width: 13, height: 13, color: 'var(--accent-primary)' }} />
                            <span>Revenue vs Sourcing & Logistics Cost</span>
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--label-primary)' }}>{totalTons.toFixed(1)} t delivered</span>
                    </div>
                    <div style={{
                        height: 10,
                        borderRadius: 6,
                        background: 'var(--fill-primary)',
                        overflow: 'hidden',
                        display: 'flex',
                        gap: 2,
                        padding: 1
                    }}>
                        {/* Coal Sourcing Segment */}
                        <div
                            style={{
                                width: `${Math.max(10, Math.min(85, totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 70))}%`,
                                background: 'var(--ios-blue)',
                                borderRadius: '4px 0 0 4px',
                                transition: 'width 0.4s ease'
                            }}
                            title={`Cost: Rs. ${Math.round(totalCost).toLocaleString('en-PK')}`}
                        />
                        {/* Net Margin Segment */}
                        <div
                            style={{
                                flex: 1,
                                background: 'var(--ios-green)',
                                borderRadius: '0 4px 4px 0',
                                transition: 'all 0.4s ease'
                            }}
                            title={`Margin: Rs. ${Math.round(totalProfit).toLocaleString('en-PK')}`}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--label-tertiary)', marginTop: 5 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ios-blue)' }} />
                            Total Costs: Rs. {(totalCost / 100000).toFixed(1)}L
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ios-green)' }} />
                            Net Spread: Rs. {(totalProfit / 100000).toFixed(1)}L
                        </span>
                    </div>
                </div>
            </div>

            {/* ── 2x2 Interactive Metric Widgets Grid ── */}
            <div className="ios-widget-grid">
                {/* Revenue */}
                <div
                    className="ios-metric-widget"
                    onClick={() => {
                        navigate('/entries');
                        playPopSound();
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="ios-widget-title">Total Revenue</span>
                        {/* <div className="ios-widget-icon" style={{ background: 'var(--tint-blue)' }}>
                            <Activity style={{ width: 18, height: 18, color: 'var(--ios-blue)' }} strokeWidth={2.4} />
                        </div>
                        */}
                    </div>
                    <div className="ios-widget-value">
                        Rs. {(totalRevenue / 100000).toFixed(2)}<span style={{ fontSize: 13, fontWeight: 600, color: 'var(--label-secondary)', marginLeft: 3 }}>L</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--label-secondary)', marginTop: -2 }}>
                        <TrendingUp style={{ width: 12, height: 12, color: 'var(--ios-green)' }} />
                        <span>Gross invoiced value</span>
                    </div>
                </div>

                {/* Costs */}
                <div
                    className="ios-metric-widget"
                    onClick={() => {
                        navigate('/entries');
                        playPopSound();
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="ios-widget-title">Total Costs</span>
                        {/* <div className="ios-widget-icon" style={{ background: 'var(--tint-orange)' }}>
                            <Coins style={{ width: 18, height: 18, color: 'var(--ios-orange)' }} strokeWidth={2.4} />
                        </div> */}
                    </div>
                    <div className="ios-widget-value">
                        Rs. {(totalCost / 100000).toFixed(2)}<span style={{ fontSize: 13, fontWeight: 600, color: 'var(--label-secondary)', marginLeft: 3 }}>L</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--label-secondary)', marginTop: -2 }}>
                        <span>Procurement + freight</span>
                    </div>
                </div>

                {/* Total Dispatches */}
                <div
                    className="ios-metric-widget"
                    onClick={() => {
                        navigate('/entries');
                        playPopSound();
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="ios-widget-title">Dispatches</span>
                        {/* <div className="ios-widget-icon" style={{ background: 'var(--tint-teal)' }}>
                            <Truck style={{ width: 18, height: 18, color: 'var(--ios-teal)' }} strokeWidth={2.4} />
                        </div> */}
                    </div>
                    <div className="ios-widget-value">
                        {filteredDispatches.length}<span style={{ fontSize: 13, fontWeight: 600, color: 'var(--label-secondary)', marginLeft: 3 }}>Trucks</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--label-secondary)', marginTop: -2 }}>
                        <span>Avg {(totalTons / Math.max(1, filteredDispatches.length)).toFixed(1)} t / truck</span>
                    </div>
                </div>

                {/* Active Parties */}
                <div
                    className="ios-metric-widget"
                    onClick={() => {
                        navigate('/parties');
                        playPopSound();
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="ios-widget-title">Parties</span>
                        {/* <div className="ios-widget-icon" style={{ background: 'var(--tint-purple)' }}>
                            <Building2 style={{ width: 18, height: 18, color: 'var(--ios-purple)' }} strokeWidth={2.4} />
                        </div> */}
                    </div>
                    <div className="ios-widget-value">
                        {parties.length}<span style={{ fontSize: 13, fontWeight: 600, color: 'var(--label-secondary)', marginLeft: 3 }}>Plants</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--label-secondary)', marginTop: -2 }}>
                        <span>Accounts active</span>
                    </div>
                </div>
            </div>

            {/* ── Quick Deal Estimator Banner ── */}
            <div style={{ padding: '0 16px', marginBottom: 16 }}>
                <button
                    type="button"
                    onClick={() => {
                        playPopSound();
                        setIsEstimatorOpen(true);
                    }}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--separator)',
                        borderRadius: 14,
                        cursor: 'pointer',
                        textAlign: 'left',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                            style={{
                                width: 38,
                                height: 38,
                                borderRadius: 10,
                                backgroundColor: 'var(--ios-blue)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                flexShrink: 0,
                            }}
                        >
                            <Calculator style={{ width: 20, height: 20 }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--label-primary)' }}>
                                Quick Deal Estimator
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--label-secondary)', marginTop: 1 }}>
                                Calculate per-ton profit, breakeven & WhatsApp quotes
                            </div>
                        </div>
                    </div>
                    <ChevronRight style={{ width: 18, height: 18, color: 'var(--label-tertiary)' }} />
                </button>
            </div>

            {/* ── Recent Dispatches Grouped List ── */}
            <div className="ios-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="ios-group-title">Recent Dispatches</div>
                    {dispatches.length > 0 && (
                        <button
                            onClick={() => navigate('/entries')}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--ios-blue)',
                                fontSize: 14,
                                fontWeight: 500,
                                cursor: 'pointer',
                                paddingRight: 14
                            }}
                        >
                            See All
                        </button>
                    )}
                </div>

                <div className="ios-card-grouped">
                    {recentDispatches.length === 0 ? (
                        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--label-secondary)' }}>
                            <Truck style={{ width: 36, height: 36, margin: '0 auto 8px', opacity: 0.4 }} strokeWidth={1.5} />
                            <div style={{ fontSize: 16, fontWeight: 500 }}>No Dispatches Recorded</div>
                            <div style={{ fontSize: 13, marginTop: 4 }}>Tap "+ New Dispatch" to record your first truck shipment.</div>
                        </div>
                    ) : (
                        recentDispatches.map((d, i) => {
                            const party = parties.find(p => p.id === d.partyId);
                            const settlement = calculateSettlement(d);
                            const isProfit = settlement.netProfit >= 0;

                            return (
                                <div
                                    key={d.id}
                                    className="ios-cell"
                                    onClick={() => {
                                        playPopSound();
                                        setPreviewDispatch(d);
                                    }}
                                >
                                    {/* Square Glyph Badge */}
                                    <div
                                        className="ios-glyph-badge"
                                        style={{
                                            background: isProfit ? 'var(--ios-green)' : 'var(--ios-red)'
                                        }}
                                    >
                                        <Truck style={{ width: 18, height: 18 }} strokeWidth={2.2} />
                                    </div>

                                    {/* Cell Info */}
                                    <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-primary)' }}>
                                                {d.truckNumber || 'Truck Dispatch'}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 16,
                                                    fontWeight: 700,
                                                    color: isProfit ? 'var(--ios-green)' : 'var(--ios-red)'
                                                }}
                                                className="tabular-nums"
                                            >
                                                {isProfit ? '+' : ''}Rs. {Math.round(settlement.netProfit).toLocaleString('en-PK')}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                                            <span style={{
                                                fontSize: 13,
                                                color: 'var(--label-secondary)',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                maxWidth: '65%'
                                            }}>
                                                {party?.name || d.factoryName || 'Factory'}
                                            </span>
                                            <span style={{ fontSize: 12, color: 'var(--label-tertiary)' }}>
                                                {d.labReceivedWeight || 0} t · {d.date}
                                            </span>
                                        </div>
                                    </div>

                                    <ChevronRight className="ios-chevron" strokeWidth={2.5} />
                                    {i < recentDispatches.length - 1 && <div className="ios-separator with-glyph" />}
                                </div>
                            );
                        })
                    )}
                </div>
                <div className="ios-group-footnote">
                    Real-time profits calculated after GCV adjustments, Sulphur deductions, GST, and transport overheads.
                </div>
            </div>

            {/* ── Coal Sourcing & Blend Breakdown ── */}
            {coalSourcesSummary.length > 0 && (
                <div className="ios-group">
                    <div className="ios-group-title">Coal Sourcing & Blends</div>
                    <div className="ios-card-grouped">
                        {coalSourcesSummary.map((source, i) => (
                            <div key={source.name} className="ios-cell" style={{ cursor: 'default' }}>
                                <div
                                    className="ios-glyph-badge"
                                    style={{ background: 'var(--tint-teal)' }}
                                >
                                    <Flame style={{ width: 17, height: 17, color: 'var(--ios-teal)' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-primary)' }}>
                                            {source.name}
                                        </span>
                                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--label-primary)' }} className="tabular-nums">
                                            {source.totalTons.toFixed(1)} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--label-secondary)' }}>tons</span>
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                                        <span style={{ fontSize: 13, color: 'var(--label-secondary)' }}>
                                            {source.count} {source.count === 1 ? 'batch' : 'batches'} blended
                                        </span>
                                        <span style={{ fontSize: 13, color: 'var(--label-secondary)', fontWeight: 500 }} className="tabular-nums">
                                            Avg Rs. {source.avgRate.toLocaleString('en-PK')}/t
                                        </span>
                                    </div>
                                </div>
                                {i < coalSourcesSummary.length - 1 && <div className="ios-separator with-glyph" />}
                            </div>
                        ))}
                    </div>
                    <div className="ios-group-footnote">
                        Aggregated procurement tonnage and weighted average cost across dispatched trucks.
                    </div>
                </div>
            )}

            {/* ── Key Parties Grouped Section with Live Ledger Balances ── */}
            {parties.length > 0 && (
                <div className="ios-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="ios-group-title">Active Factory Accounts</div>
                        {totalReceivables > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ios-amber)', background: 'var(--tint-amber)', padding: '2px 8px', borderRadius: 8, marginRight: 16 }}>
                                Rs. {(totalReceivables / 100000).toFixed(2)}L Dues ({partiesWithDues.length})
                            </span>
                        )}
                    </div>
                    <div className="ios-card-grouped">
                        {partyBalances.slice(0, 4).map((item, i) => {
                            const { party, balance, dispatchesCount } = item;
                            const isDues = balance > 0;

                            return (
                                <div
                                    key={party.id}
                                    className="ios-cell"
                                    onClick={() => navigate(`/parties/${party.id}`)}
                                >
                                    <div
                                        className="ios-glyph-badge"
                                        style={{
                                            background: `hsl(${party.name.charCodeAt(0) * 23 % 360}, 60%, 46%)`
                                        }}
                                    >
                                        <Building2 style={{ width: 17, height: 17 }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                                        <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--label-primary)' }}>
                                            {party.name}
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--label-secondary)', marginTop: 1 }}>
                                            {dispatchesCount} dispatches · {party.contactPerson?.split(' ')[0] || 'Plant'}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', marginRight: 6 }}>
                                        <div
                                            style={{
                                                fontSize: 15,
                                                fontWeight: 600,
                                                color: isDues ? 'var(--ios-orange)' : balance < 0 ? 'var(--ios-green)' : 'var(--label-secondary)'
                                            }}
                                            className="tabular-nums"
                                        >
                                            {isDues ? 'Due ' : balance < 0 ? 'Adv ' : ''}Rs. {Math.abs(Math.round(balance)).toLocaleString('en-PK')}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--label-tertiary)' }}>
                                            {isDues ? 'Receivable' : balance < 0 ? 'Overpaid' : 'Settled'}
                                        </div>
                                    </div>
                                    <ChevronRight className="ios-chevron" strokeWidth={2.5} />
                                    {i < Math.min(partyBalances.length, 4) - 1 && <div className="ios-separator with-glyph" />}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Dispatch Inspection & Preview Bottom Sheet ── */}
            {previewDispatch && (
                <>
                    <div className="ios-modal-backdrop" onClick={() => setPreviewDispatch(null)} />
                    <div className="ios-bottom-sheet" style={{ background: 'var(--bg-grouped)', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="ios-sheet-handle" />
                        <div className="ios-sheet-header" style={{ borderBottom: '0.5px solid var(--separator)', padding: '10px 16px 12px', background: 'var(--bg-grouped)', flexShrink: 0 }}>
                            <button onClick={() => setPreviewDispatch(null)} className="ios-nav-action" style={{ fontWeight: 400 }}>Close</button>
                            <span style={{ fontSize: 17, fontWeight: 700 }}>Dispatch Preview</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <button
                                    type="button"
                                    onClick={handleShareDispatchImage}
                                    disabled={isSharingDispatch}
                                    className="ios-nav-action"
                                    title="Share Receipt as Picture"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                >
                                    {isSharingDispatch ? (
                                        <Loader2 style={{ width: 17, height: 17 }} className="animate-spin" />
                                    ) : (
                                        <Share2 style={{ width: 18, height: 18 }} strokeWidth={2.3} />
                                    )}
                                </button>
                                <button
                                    onClick={() => navigate(`/parties/${previewDispatch.partyId}/dispatch/${previewDispatch.id}`)}
                                    className="ios-nav-action"
                                    style={{ fontWeight: 600 }}
                                >
                                    Edit
                                </button>
                            </div>
                        </div>

                        <div className="ios-sheet-body" style={{ flex: 1, overflowY: 'auto', padding: '16px 0 40px', background: 'var(--bg-grouped)' }}>
                            {/* Prominent Share Picture Receipt Action */}
                            <div style={{ padding: '0 16px', marginBottom: 14 }}>
                                <button
                                    type="button"
                                    onClick={handleShareDispatchImage}
                                    disabled={isSharingDispatch}
                                    className="ios-btn ios-btn-primary"
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                >
                                    {isSharingDispatch ? (
                                        <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
                                    ) : (
                                        <Share2 style={{ width: 18, height: 18 }} strokeWidth={2.4} />
                                    )}
                                    <span>Share Settlement Receipt (Picture)</span>
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

                            {/* Contract & Lab Specifications */}
                            <div className="ios-group">
                                <div className="ios-group-title">Contract & Lab Results</div>
                                <div className="ios-card-grouped" style={{ padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 15 }}>
                                        <span style={{ color: 'var(--label-secondary)' }}>Factory Account</span>
                                        <span style={{ fontWeight: 600 }}>
                                            {parties.find(p => p.id === previewDispatch.partyId)?.name || previewDispatch.factoryName}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 15 }}>
                                        <span style={{ color: 'var(--label-secondary)' }}>Purchase Order</span>
                                        <span style={{ fontWeight: 500 }}>
                                            {pos.find(p => p.id === previewDispatch.poId)?.poNumber || 'Standard Delivery'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 15 }}>
                                        <span style={{ color: 'var(--label-secondary)' }}>Target GCV</span>
                                        <span className="tabular-nums" style={{ fontWeight: 500 }}>{previewDispatch.targetGcv || 'N/A'} kcal/kg</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 15 }}>
                                        <span style={{ color: 'var(--label-secondary)' }}>Actual GCV</span>
                                        <span className="tabular-nums" style={{ fontWeight: 500 }}>{previewDispatch.labActualGcv || 'N/A'} kcal/kg</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 15 }}>
                                        <span style={{ color: 'var(--label-secondary)' }}>Ash / Moist / Sulphur</span>
                                        <span className="tabular-nums" style={{ fontWeight: 500 }}>{previewDispatch.labAsh || 0}% / {previewDispatch.labMoisture || 0}% / {previewDispatch.labSulphur || 0}%</span>
                                    </div>
                                    <div style={{ height: 0.5, background: 'var(--separator)', margin: '10px 0' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
                                        <span style={{ fontWeight: 600 }}>Received Weight</span>
                                        <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--ios-blue)' }}>{previewDispatch.labReceivedWeight || 0} t</span>
                                    </div>
                                </div>
                            </div>

                            {/* Coal Input Blends */}
                            <div className="ios-group">
                                <div className="ios-group-title">Coal Sourcing & Blends</div>
                                <div className="ios-card-grouped">
                                    {previewDispatch.coalInputs?.map((input, idx) => (
                                        <div key={input.id || idx}>
                                            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 15 }}>{input.sourceName || 'Unnamed Coal'}</div>
                                                    <div style={{ fontSize: 13, color: 'var(--label-secondary)', marginTop: 2 }}>
                                                        {input.weight} tons @ Rs. {input.purchaseRate}/t
                                                    </div>
                                                </div>
                                                <div style={{ fontWeight: 600, fontSize: 15 }} className="tabular-nums">
                                                    Rs. {Math.round(input.weight * input.purchaseRate).toLocaleString('en-PK')}
                                                </div>
                                            </div>
                                            {idx < previewDispatch.coalInputs.length - 1 && <div className="ios-separator" />}
                                        </div>
                                    ))}
                                    {(!previewDispatch.coalInputs || previewDispatch.coalInputs.length === 0) && (
                                        <div style={{ padding: '16px', color: 'var(--label-secondary)', textAlign: 'center' }}>
                                            No raw coal inputs defined
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Settlement Breakdown */}
                            <div className="ios-group">
                                <div className="ios-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Calculator size={16} /> Settlement Financial Breakdown
                                </div>
                                <div className="ios-card-grouped" style={{ padding: '16px' }}>
                                    {(() => {
                                        const s = calculateSettlement(previewDispatch);
                                        const isProfitVal = s.netProfit >= 0;
                                        return (
                                            <>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 8 }}>
                                                    <span style={{ color: 'var(--label-secondary)' }}>Base Agreement Rate</span>
                                                    <span style={{ fontWeight: 600 }} className="tabular-nums">Rs. {previewDispatch.baseRate.toFixed(2)}</span>
                                                </div>
                                                {previewDispatch.manualDeduction ? (
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 8, color: 'var(--ios-red)' }}>
                                                        <span>- Quality Deduction</span>
                                                        <span className="tabular-nums">- Rs. {previewDispatch.manualDeduction.toFixed(2)}</span>
                                                    </div>
                                                ) : null}
                                                {previewDispatch.manualPremium ? (
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 8, color: 'var(--ios-green)' }}>
                                                        <span>+ Quality Premium</span>
                                                        <span className="tabular-nums">+ Rs. {previewDispatch.manualPremium.toFixed(2)}</span>
                                                    </div>
                                                ) : null}
                                                <div style={{ height: 0.5, background: 'var(--separator)', margin: '8px 0' }} />
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, marginBottom: 8 }}>
                                                    <span style={{ fontWeight: 700, color: 'var(--ios-blue)' }}>Payable Rate</span>
                                                    <span style={{ fontWeight: 700, color: 'var(--ios-blue)' }} className="tabular-nums">Rs. {s.payableRate.toFixed(2)}/t</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--label-secondary)', marginBottom: 6 }}>
                                                    <span>Total Revenue</span>
                                                    <span className="tabular-nums">Rs. {Math.round(s.totalRevenue).toLocaleString('en-PK')}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--label-secondary)', marginBottom: 12 }}>
                                                    <span>Total Cost</span>
                                                    <span className="tabular-nums">Rs. {Math.round(s.totalCost).toLocaleString('en-PK')}</span>
                                                </div>
                                                <div style={{
                                                    padding: '12px 14px',
                                                    borderRadius: 10,
                                                    background: isProfitVal ? 'var(--tint-green)' : 'var(--tint-red)',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <span style={{ fontSize: 15, fontWeight: 700, color: isProfitVal ? 'var(--ios-green)' : 'var(--ios-red)' }}>
                                                        Net Profit
                                                    </span>
                                                    <span style={{ fontSize: 19, fontWeight: 800, color: isProfitVal ? 'var(--ios-green)' : 'var(--ios-red)' }} className="tabular-nums">
                                                        {isProfitVal ? '+' : ''}Rs. {Math.round(s.netProfit).toLocaleString('en-PK')}
                                                    </span>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Bottom Edit Action */}
                            <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                                <button
                                    onClick={() => navigate(`/parties/${previewDispatch.partyId}/dispatch/${previewDispatch.id}`)}
                                    className="ios-btn ios-btn-secondary"
                                    style={{ width: '100%' }}
                                >
                                    Edit Dispatch Record
                                </button>
                            </div>
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
                        party={parties.find((p) => p.id === previewDispatch.partyId)}
                        po={pos.find((p) => p.id === previewDispatch.poId)}
                        settings={settings}
                    />
                </div>
            )}

            {/* Quick Deal Estimator Modal Sheet */}
            <DealEstimatorModal
                isOpen={isEstimatorOpen}
                onClose={() => setIsEstimatorOpen(false)}
            />

            {/* Feedback Toast */}
            {toastMsg && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 90,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(15, 23, 42, 0.92)',
                        color: '#FFF',
                        padding: '10px 18px',
                        borderRadius: 24,
                        fontSize: 13,
                        fontWeight: 600,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                        backdropFilter: 'blur(12px)',
                        zIndex: 99999,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        whiteSpace: 'nowrap',
                    }}
                >
                    <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--ios-green)' }} />
                    <span>{toastMsg}</span>
                </div>
            )}
        </div>
    );
}


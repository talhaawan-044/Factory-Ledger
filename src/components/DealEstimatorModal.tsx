import { useState, useMemo } from 'react';
import { Calculator, Share2, Copy, Check, Truck } from 'lucide-react';
import { playPopSound, playSuccessSound } from '../utils/delight';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

interface DealEstimatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DealEstimatorModal({ isOpen, onClose }: DealEstimatorModalProps) {
  if (!isOpen) return null;

  return <DealEstimatorContent onClose={onClose} />;
}

function DealEstimatorContent({ onClose }: { onClose: () => void }) {
  const [tons, setTons] = useState<number>(50);
  const [purchaseRate, setPurchaseRate] = useState<number>(18500);
  const [freightRate, setFreightRate] = useState<number>(3200);
  const [miscCostPerTon, setMiscCostPerTon] = useState<number>(200);
  const [sellingRate, setSellingRate] = useState<number>(23000);
  const [shortagePercent, setShortagePercent] = useState<number>(0.5); // 0.5% default transit loss
  const [copied, setCopied] = useState(false);

  // Calculations
  const calc = useMemo(() => {
    const loadedTons = Math.max(0, Number(tons) || 0);
    const buyRate = Math.max(0, Number(purchaseRate) || 0);
    const freight = Math.max(0, Number(freightRate) || 0);
    const misc = Math.max(0, Number(miscCostPerTon) || 0);
    const sellRate = Math.max(0, Number(sellingRate) || 0);
    const shortagePct = Math.max(0, Number(shortagePercent) || 0);

    const shortageTons = (loadedTons * shortagePct) / 100;
    const billedTons = Math.max(0, loadedTons - shortageTons);

    // Total Cost: Purchase is based on loaded tons; freight usually on loaded tons (or billed); misc on loaded
    const coalCost = loadedTons * buyRate;
    const freightCost = loadedTons * freight;
    const miscCost = loadedTons * misc;
    const totalCost = coalCost + freightCost + miscCost;

    // Total Revenue: Factory pays on received/billed tons
    const totalRevenue = billedTons * sellRate;
    const netProfit = totalRevenue - totalCost;

    const costPerLoadedTon = loadedTons > 0 ? totalCost / loadedTons : 0;
    const profitPerLoadedTon = loadedTons > 0 ? netProfit / loadedTons : 0;
    const marginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Breakeven selling rate per billed ton
    const breakevenRate = billedTons > 0 ? Math.ceil(totalCost / billedTons) : 0;

    return {
      loadedTons,
      billedTons,
      shortageTons,
      totalCost,
      totalRevenue,
      netProfit,
      costPerLoadedTon,
      profitPerLoadedTon,
      marginPercent,
      breakevenRate,
    };
  }, [tons, purchaseRate, freightRate, miscCostPerTon, sellingRate, shortagePercent]);

  const truckPresets = [
    { label: '10 Wheeler (35t)', tons: 35 },
    { label: '12 Wheeler (45t)', tons: 45 },
    { label: 'Trailer (55t)', tons: 55 },
    { label: 'Super (65t)', tons: 65 },
  ];

  const dealSummaryText = `*COAL DEAL ESTIMATE*\n` +
    `• Load Weight: ${calc.loadedTons.toFixed(2)} Tons\n` +
    `• Buy Rate: Rs. ${purchaseRate.toLocaleString()}/ton\n` +
    `• Freight: Rs. ${freightRate.toLocaleString()}/ton\n` +
    (miscCostPerTon > 0 ? `• Misc/Kanta: Rs. ${miscCostPerTon.toLocaleString()}/ton\n` : '') +
    `• Total Cost: Rs. ${Math.round(calc.costPerLoadedTon).toLocaleString()}/ton\n` +
    `• Selling Rate: Rs. ${sellingRate.toLocaleString()}/ton\n` +
    `• Shortage: ${shortagePercent}% (${calc.shortageTons.toFixed(2)} Tons)\n` +
    `────────────────────\n` +
    `*Net Profit: Rs. ${Math.round(calc.profitPerLoadedTon).toLocaleString()}/ton*\n` +
    `*Total Profit: Rs. ${Math.round(calc.netProfit).toLocaleString()}*\n` +
    `• Breakeven Rate: Rs. ${calc.breakevenRate.toLocaleString()}/ton\n` +
    `• Total Deal Value: Rs. ${Math.round(calc.totalRevenue).toLocaleString()}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(dealSummaryText);
      playSuccessSound();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleShare = async () => {
    playPopSound();
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          title: 'Coal Deal Estimate',
          text: dealSummaryText,
          dialogTitle: 'Share Deal Estimate',
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    handleCopy();
  };

  const isProfitable = calc.netProfit >= 0;

  return (
    <>
      {/* ── Apple Dimmed Blur Backdrop ── */}
      <div
        className="ios-modal-backdrop"
        onClick={onClose}
        style={{ zIndex: 99998 }}
      />

      {/* ── Apple iOS Modal Sheet ── */}
      <div
        className="ios-bottom-sheet"
        style={{
          zIndex: 99999,
          maxHeight: '90vh',
          height: 'auto',
          background: 'var(--bg-grouped)',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderTop: '0.5px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
          overflowY: 'auto',
        }}
      >
        {/* Grabber Handle */}
        <div
          className="ios-sheet-handle"
          style={{
            width: 36,
            height: 5,
            borderRadius: 3,
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            margin: '8px auto 4px',
          }}
        />

        {/* Navigation Bar */}
        <div
          className="ios-sheet-header"
          style={{
            padding: '10px 16px 12px',
            borderBottom: '0.5px solid var(--separator)',
            background: 'var(--bg-grouped)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--ios-blue)',
              fontSize: 17,
              fontWeight: 400,
              cursor: 'pointer',
              padding: '4px 6px',
            }}
          >
            Close
          </button>

          <span
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Calculator style={{ width: 18, height: 18, color: 'var(--ios-blue)' }} />
            Deal Estimator
          </span>

          <button
            type="button"
            onClick={handleShare}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--ios-blue)',
              fontSize: 17,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 6px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Share2 style={{ width: 16, height: 16 }} />
            Share
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ── Key Results KPI Card (Solid Colors, Zero Gradient) ── */}
          <div
            style={{
              backgroundColor: isProfitable ? 'var(--ios-green)' : 'var(--ios-red)',
              borderRadius: 16,
              padding: '18px 20px',
              color: '#ffffff',
            }}
          >
            <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.85, fontWeight: 600 }}>
              Projected Net Profit
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5, marginTop: 4 }}>
              Rs. {Math.round(calc.netProfit).toLocaleString()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
              <div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>Profit / Ton</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>
                  Rs. {Math.round(calc.profitPerLoadedTon).toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>Margin</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>
                  {calc.marginPercent.toFixed(1)}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>Breakeven Rate</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>
                  Rs. {calc.breakevenRate.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* ── Quick Truck Preset Chips ── */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Truck Capacity Presets
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {truckPresets.map(p => (
                <button
                  key={p.tons}
                  type="button"
                  onClick={() => {
                    playPopSound();
                    setTons(p.tons);
                  }}
                  style={{
                    backgroundColor: tons === p.tons ? 'var(--ios-blue)' : 'var(--bg-card)',
                    color: tons === p.tons ? '#ffffff' : 'var(--text-main)',
                    border: '1px solid var(--separator)',
                    borderRadius: 12,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontWeight: tons === p.tons ? 600 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <Truck style={{ width: 14, height: 14 }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Input Parameters Form (Apple Inset Grouped) ── */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--separator)', overflow: 'hidden' }}>
            {/* Weight Input */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--separator)' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-main)' }}>Load Weight</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Dispatch gross coal weight</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  step="0.01"
                  value={tons || ''}
                  onChange={e => setTons(parseFloat(e.target.value) || 0)}
                  style={{
                    width: 90,
                    textAlign: 'right',
                    fontSize: 16,
                    fontWeight: 600,
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid var(--separator)',
                    backgroundColor: 'var(--bg-grouped)',
                    color: 'var(--text-main)',
                  }}
                />
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Tons</span>
              </div>
            </div>

            {/* Purchase Rate */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--separator)' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-main)' }}>Purchase Rate</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Mine / source rate per ton</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  value={purchaseRate || ''}
                  onChange={e => setPurchaseRate(parseFloat(e.target.value) || 0)}
                  style={{
                    width: 100,
                    textAlign: 'right',
                    fontSize: 16,
                    fontWeight: 600,
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid var(--separator)',
                    backgroundColor: 'var(--bg-grouped)',
                    color: 'var(--text-main)',
                  }}
                />
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Rs/t</span>
              </div>
            </div>

            {/* Freight Rate */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--separator)' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-main)' }}>Freight / Transport</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Truck carriage fare per ton</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  value={freightRate || ''}
                  onChange={e => setFreightRate(parseFloat(e.target.value) || 0)}
                  style={{
                    width: 100,
                    textAlign: 'right',
                    fontSize: 16,
                    fontWeight: 600,
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid var(--separator)',
                    backgroundColor: 'var(--bg-grouped)',
                    color: 'var(--text-main)',
                  }}
                />
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Rs/t</span>
              </div>
            </div>

            {/* Misc / Commission */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--separator)' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-main)' }}>Other / Kanta / Bilty</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Weighbridge & misc fee</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  value={miscCostPerTon || ''}
                  onChange={e => setMiscCostPerTon(parseFloat(e.target.value) || 0)}
                  style={{
                    width: 100,
                    textAlign: 'right',
                    fontSize: 16,
                    fontWeight: 600,
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid var(--separator)',
                    backgroundColor: 'var(--bg-grouped)',
                    color: 'var(--text-main)',
                  }}
                />
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Rs/t</span>
              </div>
            </div>

            {/* Selling Rate */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--separator)' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ios-blue)' }}>Factory Selling Rate</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Contract billing price</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  value={sellingRate || ''}
                  onChange={e => setSellingRate(parseFloat(e.target.value) || 0)}
                  style={{
                    width: 100,
                    textAlign: 'right',
                    fontSize: 16,
                    fontWeight: 700,
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid var(--ios-blue)',
                    backgroundColor: 'var(--bg-grouped)',
                    color: 'var(--ios-blue)',
                  }}
                />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ios-blue)' }}>Rs/t</span>
              </div>
            </div>

            {/* Expected Transit Shortage */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-main)' }}>Transit Loss Allowance</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Weighbridge difference tolerance</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  step="0.1"
                  value={shortagePercent || ''}
                  onChange={e => setShortagePercent(parseFloat(e.target.value) || 0)}
                  style={{
                    width: 70,
                    textAlign: 'right',
                    fontSize: 16,
                    fontWeight: 600,
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid var(--separator)',
                    backgroundColor: 'var(--bg-grouped)',
                    color: 'var(--text-main)',
                  }}
                />
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>%</span>
              </div>
            </div>
          </div>

          {/* ── Cost Breakdown Summary Table ── */}
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, padding: '16px', border: '1px solid var(--separator)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
              Deal Financial Breakdown
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Coal Sourcing Cost:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Rs. {Math.round(calc.loadedTons * purchaseRate).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Freight / Transport Cost:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Rs. {Math.round(calc.loadedTons * freightRate).toLocaleString()}</span>
              </div>
              {miscCostPerTon > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Misc Expenses:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Rs. {Math.round(calc.loadedTons * miscCostPerTon).toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px dashed var(--separator)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Total Investment / Cost:</span>
                <span style={{ fontWeight: 700, color: 'var(--ios-red)' }}>Rs. {Math.round(calc.totalCost).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Factory Gross Billed:</span>
                <span style={{ fontWeight: 700, color: 'var(--ios-blue)' }}>Rs. {Math.round(calc.totalRevenue).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--separator)', fontSize: 15 }}>
                <span style={{ fontWeight: 700, color: isProfitable ? 'var(--ios-green)' : 'var(--ios-red)' }}>Net Profit Margin:</span>
                <span style={{ fontWeight: 700, color: isProfitable ? 'var(--ios-green)' : 'var(--ios-red)' }}>
                  {isProfitable ? '+' : ''}Rs. {Math.round(calc.netProfit).toLocaleString()} ({calc.marginPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {/* ── Actions: Copy & Close ── */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4, paddingBottom: 16 }}>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                flex: 1,
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                border: '1px solid var(--separator)',
                borderRadius: 14,
                padding: '14px',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {copied ? <Check style={{ width: 18, height: 18, color: 'var(--ios-green)' }} /> : <Copy style={{ width: 18, height: 18 }} />}
              {copied ? 'Copied to Clipboard' : 'Copy Deal Text'}
            </button>
            <button
              type="button"
              onClick={handleShare}
              style={{
                flex: 1,
                backgroundColor: 'var(--ios-blue)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 14,
                padding: '14px',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Share2 style={{ width: 18, height: 18 }} />
              WhatsApp Share
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

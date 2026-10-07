import React from 'react';
import type { Dispatch, Party, PurchaseOrder, AppSettings } from '../types';
import { calculateSettlement } from '../utils/calculations';
import { getCurrencySymbol, formatAmountNumber } from '../utils/currency';

interface DispatchReceiptProps {
  dispatch: Dispatch;
  party?: Party;
  po?: PurchaseOrder;
  settings?: AppSettings;
}

export const DispatchReceipt = React.forwardRef<HTMLDivElement, DispatchReceiptProps>(
  ({ dispatch, party, po, settings }, ref) => {
    const settlement = calculateSettlement(dispatch, settings);
    const businessName = settings?.businessName || 'AWAN COAL LOGISTICS';
    const factoryName = party?.name || dispatch.factoryName || 'Factory Client';
    const curSym = getCurrencySymbol(settings?.currency);
    const salesPct = dispatch.taxSalesPercent ?? settings?.taxFormulaSalesPercent ?? 18;
    const incomePct = dispatch.taxIncomePercent ?? settings?.taxFormulaIncomePercent ?? 5;

    const voucherId = `VCH-${(dispatch.id || '00000000').slice(0, 8).toUpperCase()}`;

    return (
      <div
        ref={ref}
        style={{
          width: 440,
          backgroundColor: '#FFFFFF',
          color: '#0F172A',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          padding: '30px 26px 26px',
          boxSizing: 'border-box',
          lineHeight: 1.45,
          position: 'relative',
        }}
      >
        {/* Top Header */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          {settings?.logoUrl && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <img
                src={settings.logoUrl}
                alt="Company Logo"
                style={{
                  maxHeight: 46,
                  maxWidth: 140,
                  objectFit: 'contain',
                }}
              />
            </div>
          )}
          <div
            style={{
              fontSize: 19,
              fontWeight: 800,
              letterSpacing: 0.5,
              color: '#0F172A',
              textTransform: 'uppercase',
            }}
          >
            {businessName}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.2,
              color: '#475569',
              textTransform: 'uppercase',
              marginTop: 2,
            }}
          >
            Official Settlement Receipt
          </div>
          <div style={{ fontSize: 9.5, color: '#64748B', marginTop: 4 }}>
            {[
              settings?.phoneNumber ? `Tel: ${settings.phoneNumber}` : null,
              settings?.ntnNumber ? `NTN: ${settings.ntnNumber}` : null,
              settings?.companyAddress ? settings.companyAddress : null,
            ]
              .filter(Boolean)
              .join('  •  ')}
          </div>
        </div>

        {/* Utilitarian Dotted Divider */}
        <div
          style={{
            borderTop: '1.5px dashed #CBD5E1',
            margin: '14px 0',
          }}
        />

        {/* Voucher Meta Info */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#475569',
            marginBottom: 14,
          }}
        >
          <div>
            <span style={{ color: '#94A3B8', textTransform: 'uppercase', fontSize: 10 }}>Receipt No:</span>{' '}
            <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{voucherId}</strong>
          </div>
          <div>
            <span style={{ color: '#94A3B8', textTransform: 'uppercase', fontSize: 10 }}>Date:</span>{' '}
            <strong style={{ color: '#0F172A' }}>{dispatch.date}</strong>
          </div>
        </div>

        {/* Consignee & Vehicle Card */}
        <div
          style={{
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, paddingRight: 10 }}>
              <div style={{ fontSize: 9.5, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>
                Factory / Consignee
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                {factoryName}
              </div>
              {po?.poNumber && (
                <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>
                  PO Ref: <strong style={{ color: '#334155' }}>{po.poNumber}</strong>
                </div>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9.5, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>
                Vehicle / Truck
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: '#0F172A',
                  marginTop: 2,
                  fontFamily: 'monospace',
                  letterSpacing: 0.5,
                }}
              >
                {dispatch.truckNumber || 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Delivery & Lab Quality Details */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            Delivery & Lab Specifications
          </div>

          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <tbody>
              {(() => {
                const totalLoaded = (dispatch.coalInputs || []).reduce((s, c) => s + (c.weight || 0), 0);
                const received = dispatch.labReceivedWeight || 0;
                const diff = received - totalLoaded;
                const hasLoadedWeight = totalLoaded > 0;

                return (
                  <>
                    {hasLoadedWeight && (
                      <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '5px 0', color: '#64748B' }}>Loaded Dispatch Weight</td>
                        <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                          {totalLoaded.toFixed(2)} Tons
                        </td>
                      </tr>
                    )}
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '5px 0', color: '#64748B' }}>Received Lab Weight</td>
                      <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                        {received.toFixed(2)} Tons
                      </td>
                    </tr>
                    {hasLoadedWeight && Math.abs(diff) >= 0.01 && (
                      <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '5px 0', color: diff < 0 ? '#DC2626' : '#16A34A' }}>
                          Transit {diff < 0 ? 'Shortage' : 'Gain'}
                        </td>
                        <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600, color: diff < 0 ? '#DC2626' : '#16A34A' }}>
                          {diff >= 0 ? '+' : ''}{diff.toFixed(2)} Tons ({((Math.abs(diff) / totalLoaded) * 100).toFixed(1)}%)
                        </td>
                      </tr>
                    )}
                  </>
                );
              })()}
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '5px 0', color: '#64748B' }}>Target GCV Contract</td>
                <td style={{ padding: '5px 0', textAlign: 'right', color: '#334155' }}>
                  {dispatch.targetGcv ? `${dispatch.targetGcv} kcal/kg` : 'N/A'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '5px 0', color: '#64748B' }}>Actual Lab Tested GCV</td>
                <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600, color: '#0F172A' }}>
                  {dispatch.labActualGcv ? (
                    <span>
                      {dispatch.labActualGcv} kcal/kg{' '}
                      {Boolean(dispatch.targetGcv) && (
                        <span style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          color: dispatch.labActualGcv >= dispatch.targetGcv ? '#16A34A' : '#DC2626'
                        }}>
                          ({dispatch.labActualGcv >= dispatch.targetGcv ? '+' : ''}{dispatch.labActualGcv - dispatch.targetGcv})
                        </span>
                      )}
                    </span>
                  ) : 'Pending'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '5px 0', color: '#64748B' }}>Lab Sulphur Content</td>
                <td style={{ padding: '5px 0', textAlign: 'right', color: '#334155', fontWeight: 600 }}>
                  {dispatch.labSulphur ? `${dispatch.labSulphur}%` : 'Standard'}
                </td>
              </tr>
              {Boolean(dispatch.labAsh && dispatch.labAsh > 0) && (
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '5px 0', color: '#64748B' }}>Lab Ash Content</td>
                  <td style={{ padding: '5px 0', textAlign: 'right', color: '#334155' }}>
                    {dispatch.labAsh}%
                  </td>
                </tr>
              )}
              {Boolean(dispatch.labMoisture && dispatch.labMoisture > 0) && (
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '5px 0', color: '#64748B' }}>Lab Moisture Content</td>
                  <td style={{ padding: '5px 0', textAlign: 'right', color: '#334155' }}>
                    {dispatch.labMoisture}%
                  </td>
                </tr>
              )}
              {Boolean(dispatch.labVm && dispatch.labVm > 0) && (
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '5px 0', color: '#64748B' }}>Volatile Matter (VM)</td>
                  <td style={{ padding: '5px 0', textAlign: 'right', color: '#334155' }}>
                    {dispatch.labVm}%
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Rate Settlement Calculation */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            Rate & Settlement Breakdown
          </div>

          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '5px 0', color: '#64748B' }}>Contract Base Rate</td>
                <td style={{ padding: '5px 0', textAlign: 'right', color: '#334155' }}>
                  {curSym} {formatAmountNumber(dispatch.baseRate || 0, settings)} / ton
                </td>
              </tr>

              {Boolean(dispatch.manualDeduction && dispatch.manualDeduction > 0) && (
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '5px 0', color: '#DC2626' }}>GCV Quality Deduction</td>
                  <td style={{ padding: '5px 0', textAlign: 'right', color: '#DC2626' }}>
                    - {curSym} {dispatch.manualDeduction} / ton
                  </td>
                </tr>
              )}

              {Boolean(dispatch.manualPremium && dispatch.manualPremium > 0) && (
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '5px 0', color: '#16A34A' }}>Quality Premium</td>
                  <td style={{ padding: '5px 0', textAlign: 'right', color: '#16A34A' }}>
                    + {curSym} {dispatch.manualPremium} / ton
                  </td>
                </tr>
              )}

              {Boolean(settlement.taxDeduction && settlement.taxDeduction > 0) && (
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '5px 0', color: '#64748B' }}>
                    Tax Withholding {dispatch.taxMethod === 'formula_18_5' ? `((Rate + ${salesPct}%) × ${incomePct}%)` : ''}
                  </td>
                  <td style={{ padding: '5px 0', textAlign: 'right', color: '#475569' }}>
                    - {curSym} {settlement.taxDeduction.toFixed(2)} / ton
                  </td>
                </tr>
              )}

              {Boolean(dispatch.commissionPerTon && dispatch.commissionPerTon > 0) && (
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '5px 0', color: '#64748B' }}>Commission / Margin</td>
                  <td style={{ padding: '5px 0', textAlign: 'right', color: '#475569' }}>
                    - {curSym} {dispatch.commissionPerTon} / ton
                  </td>
                </tr>
              )}

              <tr style={{ backgroundColor: '#F8FAFC' }}>
                <td style={{ padding: '7px 6px', fontWeight: 700, color: '#0F172A' }}>
                  Final Payable Rate
                </td>
                <td
                  style={{
                    padding: '7px 6px',
                    textAlign: 'right',
                    fontWeight: 800,
                    color: '#0F172A',
                    fontSize: 12,
                  }}
                >
                  {curSym} {settlement.payableRate.toFixed(2)} / ton
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Grand Total Revenue Highlight */}
        <div
          style={{
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            borderRadius: 8,
            padding: '14px 16px',
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              color: '#94A3B8',
              fontWeight: 600,
            }}
          >
            Total Settlement Revenue
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: 0.3,
              marginTop: 3,
              fontFamily: 'monospace',
            }}
          >
            {curSym} {formatAmountNumber(settlement.totalRevenue, settings)}
          </div>
          <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 3 }}>
            ({(dispatch.labReceivedWeight || 0).toFixed(2)} Tons × {curSym} {settlement.payableRate.toFixed(2)}/t)
          </div>
        </div>

        {Boolean(dispatch.notes && dispatch.notes.trim()) && (
          <div
            style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 6,
              padding: '8px 10px',
              fontSize: 10,
              color: '#475569',
              marginBottom: 14,
            }}
          >
            <strong style={{ color: '#0F172A' }}>Remarks / Note:</strong> {dispatch.notes}
          </div>
        )}

        {/* Authorization & Signature Block */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            paddingTop: 14,
            marginBottom: 10,
            borderTop: '1px dashed #CBD5E1',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-block',
                border: '1.5px solid #2563EB',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 9,
                fontWeight: 800,
                color: '#2563EB',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              ✓ E-VERIFIED DISPATCH VOUCHER
            </div>
            <div style={{ fontSize: 8.5, color: '#94A3B8', marginTop: 4 }}>
              System Ref: {voucherId} • Date: {dispatch.date}
            </div>
          </div>

          <div style={{ textAlign: 'center', width: 140 }}>
            {settings?.signatureUrl ? (
              <div style={{ height: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 2 }}>
                <img
                  src={settings.signatureUrl}
                  alt="Authorized Signature"
                  style={{ maxHeight: 36, maxWidth: 130, objectFit: 'contain' }}
                />
              </div>
            ) : (
              <div style={{ height: 26 }} />
            )}
            <div style={{ borderBottom: '1px solid #94A3B8', marginBottom: 4 }} />
            <div style={{ fontSize: 9.5, fontWeight: 600, color: '#475569' }}>
              Authorized Signatory
            </div>
          </div>
        </div>

        {/* Security Footer */}
        <div
          style={{
            textAlign: 'center',
            fontSize: 8.5,
            color: '#94A3B8',
            borderTop: '0.5px solid #F1F5F9',
            paddingTop: 6,
          }}
        >
          Generated electronically via {businessName} Dispatch System • Retain for audit & billing
        </div>
      </div>
    );
  }
);

DispatchReceipt.displayName = 'DispatchReceipt';

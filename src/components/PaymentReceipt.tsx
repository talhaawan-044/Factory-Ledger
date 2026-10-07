import React from 'react';
import type { Payment, Party, AppSettings } from '../types';
import { getCurrencySymbol, formatAmountNumber } from '../utils/currency';

interface PaymentReceiptProps {
  payment: Payment;
  party?: Party;
  settings?: AppSettings;
  currentBalance?: number;
}

/**
 * Simple English words converter for Pakistani Rupee amounts
 */
function numberToWords(num: number): string {
  const rounded = Math.round(Math.abs(num));
  if (rounded === 0) return 'Zero Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
  }

  return inWords(rounded) + ' Only';
}

export const PaymentReceipt = React.forwardRef<HTMLDivElement, PaymentReceiptProps>(
  ({ payment, party, settings, currentBalance }, ref) => {
    const businessName = settings?.businessName || 'AWAN COAL LOGISTICS';
    const partyName = party?.name || 'Client Account';
    const isReceived = payment.type === 'received';
    const curSym = getCurrencySymbol(settings?.currency);
    const voucherId = `RCP-${(payment.id || '00000000').slice(0, 8).toUpperCase()}`;
    const amountWords = numberToWords(payment.amount);

    return (
      <div
        ref={ref}
        style={{
          width: 440,
          backgroundColor: '#FFFFFF',
          color: '#0F172A',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          padding: '28px 24px 24px',
          boxSizing: 'border-box',
          lineHeight: 1.45,
          position: 'relative',
        }}
      >
        {/* Top Header */}
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
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
              fontSize: 20,
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
              display: 'inline-block',
              marginTop: 4,
              padding: '3px 10px',
              backgroundColor: isReceived ? '#ECFDF5' : '#FFF7ED',
              border: `1px solid ${isReceived ? '#A7F3D0' : '#FED7AA'}`,
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.8,
              color: isReceived ? '#065F46' : '#9A3412',
              textTransform: 'uppercase',
            }}
          >
            {isReceived ? 'Official Payment Receipt (Inflow)' : 'Official Payment Voucher (Outflow)'}
          </div>
          <div style={{ fontSize: 9.5, color: '#64748B', marginTop: 5 }}>
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
        <div style={{ borderTop: '1.5px dashed #CBD5E1', margin: '12px 0' }} />

        {/* Voucher Meta Info */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#475569',
            marginBottom: 12,
          }}
        >
          <div>
            <span style={{ color: '#94A3B8', textTransform: 'uppercase', fontSize: 10 }}>Receipt No:</span>{' '}
            <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{voucherId}</strong>
          </div>
          <div>
            <span style={{ color: '#94A3B8', textTransform: 'uppercase', fontSize: 10 }}>Date:</span>{' '}
            <strong style={{ color: '#0F172A' }}>{payment.date}</strong>
          </div>
        </div>

        {/* Party Info Card */}
        <div
          style={{
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 9.5, color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>
            {isReceived ? 'Received From (Payer)' : 'Paid To (Payee)'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>
            {partyName}
          </div>
          {party?.phone && (
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
              Phone: <span style={{ color: '#334155' }}>{party.phone}</span>
            </div>
          )}
          {party?.address && (
            <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 1 }}>
              Address: <span style={{ color: '#334155' }}>{party.address}</span>
            </div>
          )}
        </div>

        {/* Highlight Amount Card (Solid Color) */}
        <div
          style={{
            backgroundColor: isReceived ? '#047857' : '#C2410C',
            color: '#FFFFFF',
            borderRadius: 10,
            padding: '16px 18px',
            textAlign: 'center',
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              opacity: 0.9,
              fontWeight: 600,
            }}
          >
            {isReceived ? 'Amount Received' : 'Amount Paid'}
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: 0.3,
              marginTop: 4,
              fontFamily: 'monospace',
            }}
          >
            {curSym} {formatAmountNumber(payment.amount, settings)}
          </div>
          <div
            style={{
              fontSize: 11,
              opacity: 0.95,
              marginTop: 4,
              fontStyle: 'italic',
              fontWeight: 500,
            }}
          >
            {amountWords}
          </div>
        </div>

        {/* Payment Instrument & Settlement Details Table */}
        <div style={{ marginBottom: 14 }}>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '6px 0', color: '#64748B' }}>Payment Method</td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase' }}>
                  {payment.mode}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '6px 0', color: '#64748B' }}>Reference / Cheque #</td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                  {payment.referenceNote || 'Direct Settlement'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '6px 0', color: '#64748B' }}>Settlement Type</td>
                <td style={{ padding: '6px 0', textAlign: 'right', color: '#334155' }}>
                  Coal Account Ledger Credit
                </td>
              </tr>
              {currentBalance !== undefined && (
                <tr style={{ backgroundColor: '#F8FAFC' }}>
                  <td style={{ padding: '8px 6px', fontWeight: 700, color: '#0F172A' }}>
                    Remaining Ledger Balance
                  </td>
                  <td
                    style={{
                      padding: '8px 6px',
                      textAlign: 'right',
                      fontWeight: 800,
                      color: currentBalance > 0 ? '#DC2626' : '#16A34A',
                      fontSize: 12,
                    }}
                  >
                    {curSym} {formatAmountNumber(currentBalance, settings)}{' '}
                    <span style={{ fontSize: 10, fontWeight: 600 }}>
                      ({currentBalance > 0 ? 'Receivable' : 'Settled'})
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Authorization & Signature Block */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            paddingTop: 16,
            marginBottom: 10,
            borderTop: '1px dashed #CBD5E1',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-block',
                border: '1.5px solid #059669',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 9,
                fontWeight: 800,
                color: '#059669',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              ✓ E-VERIFIED VOUCHER
            </div>
            <div style={{ fontSize: 8.5, color: '#94A3B8', marginTop: 4 }}>
              Record Date: {payment.date}
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
          Computer generated official transaction voucher • Retain for business audit
        </div>
      </div>
    );
  }
);

PaymentReceipt.displayName = 'PaymentReceipt';

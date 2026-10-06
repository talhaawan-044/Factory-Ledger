import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Dispatch, Party, Payment, PurchaseOrder, AppSettings } from '../types';
import { calculateSettlement, calculatePartyBalance, calculateTransitLoss } from './calculations';
import { getSettings } from '../lib/db';

export interface ShareFileOptions {
  /** Base64 string (with or without data URI prefix) */
  data: string;
  fileName: string;
  mimeType: string;
  title?: string;
  text?: string;
  dialogTitle?: string;
}

/**
 * Universal file sharing engine:
 * Saves file locally and launches Android/iOS Native Share sheet via Capacitor.
 * Gracefully falls back to Web Share API or direct browser download on web.
 */
export async function shareBase64File(options: ShareFileOptions): Promise<void> {
  const { data, fileName, mimeType, title = 'Share File', text = '', dialogTitle = 'Share via' } = options;

  // Extract raw base64 data if it has data URI prefix
  const rawBase64 = data.includes(',') ? data.split(',')[1] : data;

  if (Capacitor.isNativePlatform()) {
    try {
      // 1. Write file to device Cache directory
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: rawBase64,
        directory: Directory.Cache,
      });

      // 2. Open native Android/iOS share sheet with file URI
      await Share.share({
        title,
        text,
        url: writeResult.uri,
        files: [writeResult.uri],
        dialogTitle,
      });
      return;
    } catch (err) {
      console.warn('Capacitor native share failed, falling back:', err);
    }
  }

  // Web Browser Fallback
  try {
    const byteCharacters = atob(rawBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const file = new File([blob], fileName, { type: mimeType });

    // Try Web Share API with files if supported
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title,
        text,
      });
      return;
    }

    // Direct browser download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (webErr) {
    console.error('File export download failed:', webErr);
    throw webErr;
  }
}

/**
 * Capture an off-screen or rendered receipt DOM element as a crisp 3x image
 * and trigger native sharing.
 */
export async function shareReceiptImage(
  element: HTMLElement,
  dispatch: Dispatch,
  party?: Party
): Promise<void> {
  // Capture high-DPI image with html2canvas (scale: 3 for ultra-sharp mobile rendering)
  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    logging: false,
    backgroundColor: '#FFFFFF',
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const dataUrl = canvas.toDataURL('image/png');
  const safeTruck = (dispatch.truckNumber || 'truck').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Receipt-${safeTruck}-${dispatch.date}.png`;
  const partyName = party?.name || dispatch.factoryName || 'Factory';

  await shareBase64File({
    data: dataUrl,
    fileName,
    mimeType: 'image/png',
    title: `Receipt - ${dispatch.truckNumber || 'Dispatch'}`,
    text: `Coal Dispatch Settlement Receipt for ${dispatch.truckNumber} delivered to ${partyName} on ${dispatch.date}.`,
    dialogTitle: 'Share Dispatch Receipt',
  });
}

/**
 * Capture an off-screen or rendered payment voucher DOM element as a crisp 3x image
 * and trigger native sharing.
 */
export async function sharePaymentImage(
  element: HTMLElement,
  payment: Payment,
  party?: Party
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    logging: false,
    backgroundColor: '#FFFFFF',
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const dataUrl = canvas.toDataURL('image/png');
  const safeId = (payment.id || 'voucher').slice(0, 8).toUpperCase();
  const safeParty = (party?.name || 'Party').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `PaymentVoucher-${safeParty}-${safeId}-${payment.date}.png`;

  await shareBase64File({
    data: dataUrl,
    fileName,
    mimeType: 'image/png',
    title: `Payment Voucher - ${party?.name || 'Voucher'}`,
    text: `Official Payment Voucher for ${party?.name || 'Party'}: Rs. ${Math.round(payment.amount).toLocaleString('en-PK')} (${payment.mode.toUpperCase()}) on ${payment.date}.`,
    dialogTitle: 'Share Payment Voucher',
  });
}

export interface ExportDispatchesPdfOptions {
  title?: string;
  subtitle?: string;
  partyName?: string;
  party?: Party;
  payments?: Payment[];
  dateRange?: string;
  dispatches: Dispatch[];
  parties: Party[];
  pos: PurchaseOrder[];
  settings?: AppSettings;
}

/**
 * Universal PDF Export:
 * - If exporting for a single party (party or payments provided), produces an executive Portrait A4 Statement of Account.
 * - If exporting multiple parties / all dispatches, produces a high-density Landscape A4 Fleet Audit Report.
 */
export async function exportDispatchesPdf(options: ExportDispatchesPdfOptions): Promise<void> {
  const dbSettings = await getSettings();
  const settings: AppSettings = {
    ...dbSettings,
    ...(options.settings || {}),
    logoUrl: options.settings?.logoUrl || dbSettings.logoUrl || '',
    signatureUrl: options.settings?.signatureUrl || dbSettings.signatureUrl || '',
  };

  // Determine if this is a single party account statement or a multi-dispatch fleet audit
  const isPartyStatement = Boolean(options.party || (options.partyName && options.payments));

  if (isPartyStatement) {
    await exportPartyStatementPdf({ ...options, settings });
  } else {
    await exportFleetAuditPdf({ ...options, settings });
  }
}

/**
 * Generates an executive Portrait A4 Statement of Account for a single party
 */
async function exportPartyStatementPdf(options: ExportDispatchesPdfOptions & { settings: AppSettings }): Promise<void> {
  const {
    dispatches,
    payments = [],
    pos,
    settings,
  } = options;

  const party = options.party || options.parties.find((p) => p.name === options.partyName);
  const partyName = party?.name || options.partyName || 'Party Client';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // 1. Header Bar: Business Info
  let headerTextX = margin;
  if (settings.logoUrl && settings.logoUrl.startsWith('data:image')) {
    try {
      const isPng = settings.logoUrl.includes('image/png');
      doc.addImage(settings.logoUrl, isPng ? 'PNG' : 'JPEG', margin, 11, 14, 14);
      headerTextX = margin + 17;
    } catch {
      // ignore if image format unsupported
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text((settings.businessName || 'AWAN COAL LOGISTICS').toUpperCase(), headerTextX, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  const subline = [
    settings.phoneNumber ? `Tel: ${settings.phoneNumber}` : '',
    settings.ntnNumber ? `NTN: ${settings.ntnNumber}` : '',
    settings.companyAddress ? settings.companyAddress : '',
  ]
    .filter(Boolean)
    .join('  •  ');
  if (subline) {
    doc.text(subline, headerTextX, 23);
  }

  // Right-aligned Document Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('STATEMENT OF ACCOUNT', pageWidth - margin, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Date: ${new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}`, pageWidth - margin, 23, { align: 'right' });

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, 27, pageWidth - margin, 27);

  // 2. Party Information Card
  const partyCardY = 32;
  const partyCardHeight = 20;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, partyCardY, contentWidth, partyCardHeight, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, partyCardY, contentWidth, partyCardHeight, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('ACCOUNT HOLDER / FACTORY:', margin + 4, partyCardY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(partyName, margin + 4, partyCardY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const partyMeta = [
    party?.contactPerson ? `Attn: ${party.contactPerson}` : null,
    party?.phone ? `Phone: ${party.phone}` : null,
    party?.address ? `Location: ${party.address}` : null,
  ].filter(Boolean).join('   |   ');
  doc.text(partyMeta || 'Verified Ledger Account', margin + 4, partyCardY + 17);

  // 3. Executive KPI Summary Cards
  const balanceResult = calculatePartyBalance(dispatches, payments);
  const totalTons = balanceResult.totalTons;
  const totalBilled = balanceResult.totalBilled;
  const totalReceived = balanceResult.totalPaymentsReceived;
  const outstanding = balanceResult.outstandingBalance;

  const kpiY = 56;
  const kpiHeight = 16;
  const kpiGap = 3;
  const kpiWidth = (contentWidth - kpiGap * 3) / 4;

  const kpis = [
    { label: 'COAL DELIVERED', value: `${totalTons.toFixed(2)} t`, sub: `${dispatches.length} Trucks`, color: [15, 23, 42] },
    { label: 'TOTAL INVOICED', value: `Rs. ${Math.round(totalBilled).toLocaleString('en-PK')}`, sub: 'Billed Deliveries', color: [15, 23, 42] },
    { label: 'PAYMENTS CREDITED', value: `Rs. ${Math.round(totalReceived).toLocaleString('en-PK')}`, sub: `${payments.filter((p) => p.type === 'received').length} Payments`, color: [5, 150, 105] },
    {
      label: 'NET BALANCE DUE',
      value: `Rs. ${Math.abs(Math.round(outstanding)).toLocaleString('en-PK')}`,
      sub: outstanding > 0 ? 'Receivable' : 'Settled',
      color: outstanding > 0 ? [220, 38, 38] : [5, 150, 105],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const x = margin + idx * (kpiWidth + kpiGap);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, kpiY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 3, kpiY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, x + 3, kpiY + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.sub, x + 3, kpiY + 14);
  });

  // 4. Combined Chronological Statement Ledger
  type StatementEntry =
    | { kind: 'dispatch'; date: string; data: Dispatch }
    | { kind: 'payment'; date: string; data: Payment };

  const entries: StatementEntry[] = [
    ...dispatches.map((d) => ({ kind: 'dispatch' as const, date: d.date, data: d })),
    ...payments.map((p) => ({ kind: 'payment' as const, date: p.date, data: p })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  let runningBal = 0;
  const tableRows: any[] = [];

  entries.forEach((entry, idx) => {
    if (entry.kind === 'dispatch') {
      const d = entry.data;
      const s = calculateSettlement(d);
      const invoiced = Math.round(s.totalRevenue);
      runningBal += invoiced;
      const po = pos?.find((p) => p.id === d.poId);
      const transit = calculateTransitLoss(d);

      const sourcesStr =
        d.coalInputs && d.coalInputs.length > 0
          ? d.coalInputs
              .filter((c) => (c.weight || 0) > 0)
              .map((c) => `${c.sourceName || 'Coal'}: ${c.weight}t`)
              .join(', ')
          : '';

      // 4-Line Detailed Specification for each dispatch
      const lines: string[] = [];

      // Line 1: Primary logistics & commercial settlement rate
      const truckPart = d.truckNumber ? `Truck: ${d.truckNumber}` : 'Direct Delivery';
      const destPart = d.factoryName ? ` • ${d.factoryName}` : '';
      const ratePart = ` • Rs. ${Math.round(s.payableRate).toLocaleString('en-PK')}/t${
        d.baseRate && Math.round(d.baseRate) !== Math.round(s.payableRate)
          ? ` (Base: Rs. ${Math.round(d.baseRate).toLocaleString('en-PK')})`
          : ''
      }`;
      lines.push(`DELIVERY: ${truckPart}${destPart}${ratePart}`);

      // Line 2: Lab Quality Analysis (GCV with delta, Sulphur, Moisture, Ash, VM)
      const labParts: string[] = [];
      if (d.labActualGcv) {
        const delta = d.targetGcv ? d.labActualGcv - d.targetGcv : null;
        const deltaStr = delta !== null ? ` (${delta >= 0 ? '+' : ''}${delta})` : '';
        labParts.push(`GCV: ${d.labActualGcv} kcal${deltaStr}`);
      } else if (d.targetGcv) {
        labParts.push(`Target GCV: ${d.targetGcv} kcal`);
      }
      if (d.labSulphur) labParts.push(`S: ${d.labSulphur}%`);
      if (d.labMoisture) labParts.push(`Moist: ${d.labMoisture}%`);
      if (d.labAsh) labParts.push(`Ash: ${d.labAsh}%`);
      if (d.labVm) labParts.push(`VM: ${d.labVm}%`);
      lines.push(`LAB SPECS: ${labParts.length > 0 ? labParts.join('  •  ') : 'Standard Specifications Verified'}`);

      // Line 3: Commercial & Rate Adjustments
      const adjParts: string[] = [];
      if (d.manualPremium) adjParts.push(`Bonus: +Rs.${d.manualPremium}/t`);
      if (d.manualDeduction) adjParts.push(`GCV Ded: -Rs.${d.manualDeduction}/t`);
      if (s.taxDeduction) adjParts.push(`Tax: -Rs.${s.taxDeduction.toFixed(2)}/t`);
      if (d.commissionPerTon) adjParts.push(`Comm: -Rs.${d.commissionPerTon}/t`);
      lines.push(`RATE AUDIT: ${adjParts.length > 0 ? adjParts.join('  •  ') : 'Standard Settlement Rate'}`);

      // Line 4: Sourcing, Transit Loss & Delivery Notes
      const logParts: string[] = [];
      if (transit.totalLoadedWeight > 0 && Math.abs(transit.diff) >= 0.01) {
        logParts.push(`Transit: ${transit.diff < 0 ? '-' : '+'}${Math.abs(transit.diff).toFixed(2)}t (${transit.lossPercentage.toFixed(1)}%)`);
      }
      if (sourcesStr) {
        logParts.push(`Mines: ${sourcesStr}`);
      }
      if (d.notes) {
        logParts.push(`Note: ${d.notes}`);
      }
      lines.push(`LOGISTICS: ${logParts.length > 0 ? logParts.join('  •  ') : 'Verified & Cleared'}`);

      tableRows.push([
        (idx + 1).toString(),
        d.date || '-',
        lines.join('\n'),
        po?.poNumber || '-',
        (d.labReceivedWeight || 0).toFixed(2),
        invoiced.toLocaleString('en-PK'),
        '-',
        Math.round(runningBal).toLocaleString('en-PK'),
      ]);
    } else {
      const p = entry.data;
      const isReceived = p.type === 'received';
      const amount = Math.round(p.amount);
      if (isReceived) {
        runningBal -= amount;
      } else {
        runningBal += amount;
      }

      const pLines: string[] = [
        `PAYMENT ${isReceived ? 'CREDIT / RECEIVED' : 'DEBIT / OUTFLOW'} (${p.mode.toUpperCase()})`,
        `Voucher / Ref: ${p.referenceNote || 'Direct Settlement'}`,
        `Txn ID: #${(p.id || '').slice(0, 10).toUpperCase()}`
      ];

      tableRows.push([
        (idx + 1).toString(),
        p.date || '-',
        pLines.join('\n'),
        (p.id || '').slice(0, 8).toUpperCase(),
        '-',
        !isReceived ? amount.toLocaleString('en-PK') : '-',
        isReceived ? amount.toLocaleString('en-PK') : '-',
        Math.round(runningBal).toLocaleString('en-PK'),
      ]);
    }
  });

  // Table Footer
  const tableFooter = [
    [
      '',
      'TOTALS',
      `${dispatches.length} Deliveries • ${payments.length} Payments`,
      '',
      totalTons.toFixed(2),
      Math.round(totalBilled).toLocaleString('en-PK'),
      Math.round(totalReceived).toLocaleString('en-PK'),
      `Rs. ${Math.round(outstanding).toLocaleString('en-PK')}`,
    ],
  ];

  autoTable(doc, {
    startY: kpiY + kpiHeight + 6,
    margin: { left: margin, right: margin, bottom: 20 },
    head: [
      [
        '#',
        'Date',
        'Particulars & Detailed Description',
        'Ref / PO',
        'Weight (t)',
        'Invoiced (Rs)',
        'Payment (Rs)',
        'Balance (Rs)',
      ],
    ],
    body: tableRows,
    foot: tableFooter,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3,
    },
    footStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 3.5,
    },
    bodyStyles: {
      fontSize: 7.2,
      textColor: [51, 65, 85],
      cellPadding: { top: 3.2, bottom: 3.2, left: 2.5, right: 2.5 },
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', valign: 'middle' },
      1: { cellWidth: 20, valign: 'middle' },
      2: { cellWidth: 64, valign: 'top' },
      3: { cellWidth: 16, halign: 'center', valign: 'middle' },
      4: { cellWidth: 16, halign: 'right', valign: 'middle' },
      5: { cellWidth: 19, halign: 'right', valign: 'middle' },
      6: { cellWidth: 19, halign: 'right', valign: 'middle' },
      7: { cellWidth: 20, halign: 'right', valign: 'middle' },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const rowIndex = data.row.index;
        const isEven = rowIndex % 2 === 0;
        const rawArr = Array.isArray(data.row.raw) ? (data.row.raw as any[]) : null;
        const descText = rawArr ? String(rawArr[2] || '') : '';
        const isPayment = descText.includes('PAYMENT CREDIT') || descText.includes('PAYMENT DEBIT');

        if (isPayment) {
          const isReceived = descText.includes('PAYMENT CREDIT');
          data.cell.styles.fillColor = isReceived ? [240, 253, 244] : [255, 241, 242]; // emerald-50 or rose-50
          if (data.column.index === 6 && isReceived) {
            data.cell.styles.textColor = [5, 150, 105]; // emerald-600
            data.cell.styles.fontStyle = 'bold';
          } else if (data.column.index === 5 && !isReceived) {
            data.cell.styles.textColor = [220, 38, 38]; // rose-600
            data.cell.styles.fontStyle = 'bold';
          }
        } else {
          // Alternating colors for dispatches
          // Even entry: Pure Crisp White [255, 255, 255]
          // Odd entry: Soft Cool Slate-100 Tint [241, 245, 249]
          data.cell.styles.fillColor = isEven ? [255, 255, 255] : [241, 245, 249];
        }

        // Prominent border between entries so where each entry starts and ends is immediately clear
        data.cell.styles.lineWidth = { top: 0, right: 0.15, bottom: 0.75, left: 0.15 };
        data.cell.styles.lineColor = [203, 213, 225]; // slate-300

        // Column typography
        if (data.column.index === 0) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [71, 85, 105];
        } else if (data.column.index === 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [15, 23, 42];
        } else if (data.column.index === 2) {
          data.cell.styles.textColor = [30, 41, 59];
        } else if (data.column.index === 4) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [15, 23, 42];
        } else if (data.column.index === 7) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [15, 23, 42];
        }
      }
    },
    didDrawPage: () => {
      const pageStr = `Page ${doc.getNumberOfPages()} of ${doc.getNumberOfPages()}  •  ${settings.businessName || 'Awan Coal Logistics'} Official Statement`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(pageStr, pageWidth / 2, pageHeight - 8, { align: 'center' });
    },
  });

  // --- Official Authorized Signature Section on Last Page ---
  doc.setPage(doc.getNumberOfPages());
  const finalY = (doc as any).lastAutoTable?.finalY || 140;

  // Ensure adequate vertical clearance for signature block (needs ~35mm)
  let sigY: number;
  if (finalY + 36 > pageHeight - 15) {
    doc.addPage();
    doc.setPage(doc.getNumberOfPages());
    sigY = 24;
  } else {
    sigY = finalY + 8;
  }

  const sigWidth = 55;
  const sigBoxHeight = 18;
  const sigX = pageWidth - margin - sigWidth;

  // Left-aligned courtesy & system note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Thank you for conducting business with us.', margin, sigY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Official Account Statement • Computer generated electronic record', margin, sigY + 18.5);

  // Right-aligned Authorized Signatory Block
  if (settings.signatureUrl && settings.signatureUrl.trim().length > 0) {
    // 1. Signature card container
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(sigX, sigY, sigWidth, sigBoxHeight, 2, 2, 'FD');

    // 2. Embedded signature image
    try {
      const isPng = !settings.signatureUrl.includes('image/jpeg');
      doc.addImage(settings.signatureUrl, isPng ? 'PNG' : 'JPEG', sigX + 2, sigY + 1, sigWidth - 4, sigBoxHeight - 2, undefined, 'FAST');
    } catch (err) {
      console.warn('Failed to embed signature in Statement PDF:', err);
    }

    // 3. Signature line
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.5);
    doc.line(sigX, sigY + sigBoxHeight + 2, sigX + sigWidth, sigY + sigBoxHeight + 2);

    // 4. Signatory / Trader Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text((settings.userName || 'Authorized Signatory').toUpperCase(), sigX + sigWidth / 2, sigY + sigBoxHeight + 6.5, { align: 'center' });

    // 5. Signatory title
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Authorized Signatory', sigX + sigWidth / 2, sigY + sigBoxHeight + 10, { align: 'center' });
  } else {
    // Placeholder line for manual sign/stamp if signature image not yet configured
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.5);
    doc.line(sigX, sigY + 16, sigX + sigWidth, sigY + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text((settings.userName || 'Authorized Signatory').toUpperCase(), sigX + sigWidth / 2, sigY + 20.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Authorized Signatory', sigX + sigWidth / 2, sigY + 24, { align: 'center' });
  }

  const pdfDataUri = doc.output('datauristring');
  const safeName = partyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStamp = new Date().toISOString().split('T')[0];
  const fileName = `Statement-${safeName}-${dateStamp}.pdf`;

  await shareBase64File({
    data: pdfDataUri,
    fileName,
    mimeType: 'application/pdf',
    title: `Account Statement - ${partyName}`,
    text: `Official Statement of Account for ${partyName}. Net Balance Due: Rs. ${Math.round(outstanding).toLocaleString('en-PK')}.`,
    dialogTitle: 'Share Statement PDF',
  });
}

/**
 * Generates a high-density Landscape A4 Fleet & Multi-Dispatch Audit Report
 */
async function exportFleetAuditPdf(options: ExportDispatchesPdfOptions & { settings: AppSettings }): Promise<void> {
  const {
    title = 'COAL DISPATCH LEDGER & FLEET AUDIT',
    subtitle,
    partyName,
    dateRange,
    dispatches,
    parties,
    pos,
    settings,
  } = options;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Header: Business Information
  let headerTextX = margin;
  if (settings.logoUrl && settings.logoUrl.startsWith('data:image')) {
    try {
      const isPng = settings.logoUrl.includes('image/png');
      doc.addImage(settings.logoUrl, isPng ? 'PNG' : 'JPEG', margin, 9, 14, 14);
      headerTextX = margin + 17;
    } catch {
      // ignore if image format unsupported
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text((settings.businessName || 'AWAN COAL LOGISTICS').toUpperCase(), headerTextX, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  const subline = [
    settings.phoneNumber ? `Tel: ${settings.phoneNumber}` : '',
    settings.ntnNumber ? `NTN: ${settings.ntnNumber}` : '',
    settings.companyAddress ? settings.companyAddress : '',
  ]
    .filter(Boolean)
    .join('  •  ');
  if (subline) {
    doc.text(subline, headerTextX, 21);
  }

  // Report Title & Meta
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(title, margin, 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const metaParts = [
    partyName ? `Party: ${partyName}` : null,
    dateRange ? `Period: ${dateRange}` : null,
    subtitle ? subtitle : null,
    `Generated: ${new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    `Total Dispatches: ${dispatches.length}`,
  ].filter(Boolean);
  doc.text(metaParts.join('   •   '), margin, 35);

  // Summary Metrics Banner
  const totalTons = dispatches.reduce((sum, d) => sum + (d.labReceivedWeight || 0), 0);
  const totalRevenue = dispatches.reduce((sum, d) => sum + calculateSettlement(d).totalRevenue, 0);
  const totalCost = dispatches.reduce((sum, d) => sum + calculateSettlement(d).totalCost, 0);
  const totalProfit = dispatches.reduce((sum, d) => sum + calculateSettlement(d).netProfit, 0);

  const bannerY = 40;
  const bannerHeight = 14;
  const bannerWidth = pageWidth - margin * 2;

  // Light gray background box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, bannerY, bannerWidth, bannerHeight, 2, 2, 'FD');

  const colWidth = bannerWidth / 4;
  const kpiItems = [
    { label: 'TOTAL DELIVERED', value: `${totalTons.toFixed(2)} Tons` },
    { label: 'TOTAL REVENUE', value: `Rs. ${Math.round(totalRevenue).toLocaleString('en-PK')}` },
    { label: 'TOTAL COST', value: `Rs. ${Math.round(totalCost).toLocaleString('en-PK')}` },
    { label: 'NET PROFIT', value: `Rs. ${Math.round(totalProfit).toLocaleString('en-PK')}` },
  ];

  kpiItems.forEach((kpi, idx) => {
    const x = margin + idx * colWidth + 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x, bannerY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.value, x, bannerY + 10.5);
  });

  // Table Data - 2 lines per dispatch entry with alternating colors
  const sortedDispatches = [...dispatches].sort((a, b) => b.date.localeCompare(a.date));

  const tableRows: any[] = [];
  sortedDispatches.forEach((d, index) => {
    const party = parties.find((p) => p.id === d.partyId);
    const po = pos.find((p) => p.id === d.poId);
    const s = calculateSettlement(d);
    const transit = calculateTransitLoss(d);

    const gcvDelta = d.targetGcv && d.labActualGcv ? d.labActualGcv - d.targetGcv : null;
    const gcvDeltaStr = gcvDelta !== null ? `(${gcvDelta >= 0 ? '+' : ''}${gcvDelta} kcal)` : '';
    const marginPct = s.totalRevenue > 0 ? ((s.netProfit / s.totalRevenue) * 100).toFixed(1) : '0';

    const sourcesStr =
      d.coalInputs && d.coalInputs.length > 0
        ? d.coalInputs
            .filter((c) => (c.weight || 0) > 0)
            .map((c) => `${c.sourceName || 'Coal'}: ${c.weight}t`)
            .join(', ') || 'Direct Dispatch'
        : 'Direct Dispatch';

    // Line 1: Primary logistics & commercial settlement numbers
    const row1 = [
      { content: (index + 1).toString(), rowSpan: 3 },
      d.date || '-',
      d.truckNumber || '-',
      party?.name || d.factoryName || '-',
      po?.poNumber || '-',
      (d.labReceivedWeight || 0).toFixed(2),
      Math.round(d.baseRate || 0).toLocaleString('en-PK'),
      s.payableRate.toFixed(2),
      Math.round(s.totalRevenue).toLocaleString('en-PK'),
      Math.round(s.totalCost).toLocaleString('en-PK'),
      `${s.netProfit >= 0 ? '+' : ''}${Math.round(s.netProfit).toLocaleString('en-PK')}`,
    ];

    // Line 2: Lab specifications & quality audit
    const labSpecsList = [
      `Target: ${d.targetGcv ? d.targetGcv + ' kcal' : '-'}`,
      `Actual Lab: ${d.labActualGcv ? d.labActualGcv + ' kcal' : '-'} ${gcvDeltaStr}`.trim(),
      `Sulphur: ${d.labSulphur ? d.labSulphur + '%' : '-'}`,
      d.labAsh ? `Ash: ${d.labAsh}%` : null,
      d.labMoisture ? `Moisture: ${d.labMoisture}%` : null,
      d.labVm ? `VM: ${d.labVm}%` : null,
      transit.totalLoadedWeight > 0 && Math.abs(transit.diff) >= 0.01
        ? `Transit: ${transit.diff < 0 ? '-' : '+'}${Math.abs(transit.diff).toFixed(2)}t (${transit.lossPercentage.toFixed(1)}%)`
        : null,
    ].filter(Boolean);

    const labText = `LAB QUALITY & ANALYSIS: ${labSpecsList.join('  •  ')}`;

    // Line 3: Commercial adjustments, pricing audit & sourcing
    const adjList = [
      d.manualDeduction ? `GCV Ded: -Rs.${d.manualDeduction}/t` : null,
      d.manualPremium ? `Bonus: +Rs.${d.manualPremium}/t` : null,
      s.taxDeduction ? `Tax: -Rs.${s.taxDeduction.toFixed(2)}/t` : null,
      d.commissionPerTon ? `Comm: -Rs.${d.commissionPerTon}/t` : null,
    ].filter(Boolean);

    const adjText = adjList.length > 0 ? `RATE AUDIT: ${adjList.join('  •  ')}` : 'RATE AUDIT: Standard Settlement';

    const notesSnippet = d.notes ? `Note: ${d.notes}` : '';
    const sourcingText = [
      `Sources: ${sourcesStr}`,
      `Margin: ${marginPct}%`,
      notesSnippet,
    ]
      .filter(Boolean)
      .join('  •  ');

    const row2 = [
      { content: labText, colSpan: 10 },
    ];

    const row3 = [
      { content: `${adjText}   |   SOURCING & LOGISTICS: ${sourcingText}`, colSpan: 10 },
    ];

    tableRows.push(row1, row2, row3);
  });

  // Add Grand Totals footer row
  const tableFooter = [
    [
      '',
      'TOTALS',
      `${dispatches.length} trucks`,
      '',
      '',
      totalTons.toFixed(2),
      '-',
      '-',
      Math.round(totalRevenue).toLocaleString('en-PK'),
      Math.round(totalCost).toLocaleString('en-PK'),
      `${totalProfit >= 0 ? '+' : ''}${Math.round(totalProfit).toLocaleString('en-PK')}`,
    ],
  ];

  autoTable(doc, {
    startY: bannerY + bannerHeight + 5,
    margin: { left: margin, right: margin, bottom: 15 },
    head: [
      [
        '#',
        'Date',
        'Truck No',
        'Factory / Consignee',
        'PO #',
        'Tons',
        'Base (Rs)',
        'Payable (Rs)',
        'Revenue (Rs)',
        'Cost (Rs)',
        'Profit (Rs)',
      ],
    ],
    body: tableRows,
    foot: tableFooter,
    theme: 'grid',
    rowPageBreak: 'avoid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      cellPadding: 2.5,
    },
    footStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
      cellPadding: 2,
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const rowIndex = data.row.index;
        const entryIndex = Math.floor(rowIndex / 3);
        const subRow = rowIndex % 3;
        const isEvenEntry = entryIndex % 2 === 0;

        const line1Bg: [number, number, number] = isEvenEntry ? [255, 255, 255] : [241, 245, 249];
        const line2Bg: [number, number, number] = isEvenEntry ? [250, 252, 255] : [236, 241, 246];
        const line3Bg: [number, number, number] = isEvenEntry ? [246, 249, 254] : [232, 237, 243];

        data.cell.styles.fillColor = subRow === 0 ? line1Bg : subRow === 1 ? line2Bg : line3Bg;

        if (subRow === 0) {
          data.cell.styles.fontSize = 8;
          data.cell.styles.cellPadding = { top: 2.2, bottom: 1.5, left: 2.5, right: 2.5 };
          data.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.15, left: 0 };
          data.cell.styles.lineColor = isEvenEntry ? [241, 245, 249] : [226, 232, 240];

          if (data.column.index === 2) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [15, 23, 42];
          }

          if (data.column.index === 10) {
            const textVal = String(data.cell.raw || '');
            if (textVal.startsWith('+')) {
              data.cell.styles.textColor = [22, 163, 74];
              data.cell.styles.fontStyle = 'bold';
            } else if (textVal.startsWith('-')) {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        } else if (subRow === 1) {
          data.cell.styles.fontSize = 7;
          data.cell.styles.textColor = [51, 65, 85];
          data.cell.styles.fontStyle = 'normal';
          data.cell.styles.cellPadding = { top: 1.2, bottom: 1.2, left: 3, right: 3 };
          data.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.15, left: 0 };
          data.cell.styles.lineColor = [226, 232, 240];
        } else {
          data.cell.styles.fontSize = 7;
          data.cell.styles.textColor = [71, 85, 105];
          data.cell.styles.fontStyle = 'normal';
          data.cell.styles.cellPadding = { top: 1.2, bottom: 2.2, left: 3, right: 3 };
          // Bold bottom dividing border on the last line of the entry!
          data.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.8, left: 0 };
          data.cell.styles.lineColor = [148, 163, 184];
        }

        if (data.column.index === 0) {
          data.cell.styles.lineWidth = { top: 0, right: 0.2, bottom: 0.8, left: 0 };
          data.cell.styles.lineColor = [148, 163, 184];
          data.cell.styles.valign = 'middle';
          data.cell.styles.halign = 'center';
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [100, 116, 139];
          data.cell.styles.fillColor = isEvenEntry ? ([255, 255, 255] as [number, number, number]) : ([241, 245, 249] as [number, number, number]);
        }
      }
    },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 21 },
      2: { cellWidth: 25, fontStyle: 'bold' },
      3: { cellWidth: 46 },
      4: { cellWidth: 23 },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 24, halign: 'right' },
      8: { cellWidth: 28, halign: 'right' },
      9: { cellWidth: 27, halign: 'right' },
      10: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    didDrawPage: () => {
      const str = `Page ${doc.getNumberOfPages()} of ${doc.getNumberOfPages()}  •  ${settings.businessName || 'Awan Coal Logistics'} Official Ledger`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(str, pageWidth / 2, pageHeight - 8, { align: 'center' });
    },
  });

  // --- Official Authorized Signature Section on Last Page ---
  doc.setPage(doc.getNumberOfPages());
  const finalY = (doc as any).lastAutoTable?.finalY || 140;

  let sigY: number;
  if (finalY + 36 > pageHeight - 15) {
    doc.addPage();
    doc.setPage(doc.getNumberOfPages());
    sigY = 22;
  } else {
    sigY = finalY + 7;
  }

  const sigWidth = 55;
  const sigBoxHeight = 18;
  const sigX = pageWidth - margin - sigWidth;

  // Left-aligned courtesy & system note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Thank you for conducting business with us.', margin, sigY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Official Dispatch Ledger Audit • ${settings.businessName || 'Awan Coal Logistics'}`, margin, sigY + 18.5);

  // Right-aligned Authorized Signatory Block
  if (settings.signatureUrl && settings.signatureUrl.trim().length > 0) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(sigX, sigY, sigWidth, sigBoxHeight, 2, 2, 'FD');

    try {
      const isPng = !settings.signatureUrl.includes('image/jpeg');
      doc.addImage(settings.signatureUrl, isPng ? 'PNG' : 'JPEG', sigX + 2, sigY + 1, sigWidth - 4, sigBoxHeight - 2, undefined, 'FAST');
    } catch (err) {
      console.warn('Failed to embed signature in Fleet Ledger PDF:', err);
    }

    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.5);
    doc.line(sigX, sigY + sigBoxHeight + 2, sigX + sigWidth, sigY + sigBoxHeight + 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text((settings.userName || 'Authorized Signatory').toUpperCase(), sigX + sigWidth / 2, sigY + sigBoxHeight + 6.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Authorized Signatory', sigX + sigWidth / 2, sigY + sigBoxHeight + 10, { align: 'center' });
  } else {
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.5);
    doc.line(sigX, sigY + 16, sigX + sigWidth, sigY + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text((settings.userName || 'Authorized Signatory').toUpperCase(), sigX + sigWidth / 2, sigY + 20.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Authorized Signatory', sigX + sigWidth / 2, sigY + 24, { align: 'center' });
  }

  const pdfDataUri = doc.output('datauristring');
  const safeName = (partyName || 'All_Dispatches').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStamp = new Date().toISOString().split('T')[0];
  const fileName = `Ledger-${safeName}-${dateStamp}.pdf`;

  await shareBase64File({
    data: pdfDataUri,
    fileName,
    mimeType: 'application/pdf',
    title: `Factory Ledger - ${partyName || 'All Dispatches'}`,
    text: `Factory Dispatch Ledger containing ${dispatches.length} deliveries. Total: ${totalTons.toFixed(2)} tons.`,
    dialogTitle: 'Share PDF Ledger',
  });
}

export interface ExportDispatchesExcelOptions {
  fileName?: string;
  partyName?: string;
  party?: Party;
  payments?: Payment[];
  dispatches: Dispatch[];
  parties: Party[];
  pos: PurchaseOrder[];
  settings?: AppSettings;
}

/**
 * Generate a multi-sheet, beautifully formatted .xlsx workbook:
 * - If exporting for a single Party:
 *   - Sheet 1: "Account Statement" (Chronological statement with Debits, Credits & Running Balance)
 *   - Sheet 2: "Dispatches & Quality" (Full truck-by-truck technical log)
 *   - Sheet 3: "Payment Transactions" (Payment voucher receipts)
 * - If exporting All Dispatches:
 *   - Sheet 1: "Dispatches Master" (Comprehensive deliveries log)
 *   - Sheet 2: "Cost & Margin Analysis" (Procurement blends, overheads & margins)
 *   - Sheet 3: "Party Summary" (Aggregated performance per plant/customer)
 */
export async function exportDispatchesExcel(options: ExportDispatchesExcelOptions): Promise<void> {
  const { dispatches, parties, pos, payments = [] } = options;
  const settings = options.settings || (await getSettings());
  const party = options.party || parties.find((p) => p.name === options.partyName);
  const partyName = party?.name || options.partyName;
  const isSingleParty = Boolean(party || (partyName && payments.length > 0));

  const wb = XLSX.utils.book_new();
  const dateStamp = new Date().toISOString().split('T')[0];
  const companyName = settings.businessName || 'AWAN COAL LOGISTICS';

  if (isSingleParty) {
    // ════════════════════════════════════════════════════════════════════════
    // SHEET 1: ACCOUNT STATEMENT (Chronological Running Balance)
    // ════════════════════════════════════════════════════════════════════════
    const balanceResult = calculatePartyBalance(dispatches, payments);
    const totalTons = balanceResult.totalTons;
    const totalBilled = balanceResult.totalBilled;
    const totalReceived = balanceResult.totalPaymentsReceived;
    const netBalance = balanceResult.outstandingBalance;

    type LedgerEntry =
      | { kind: 'dispatch'; date: string; data: Dispatch }
      | { kind: 'payment'; date: string; data: Payment };

    const entries: LedgerEntry[] = [
      ...dispatches.map((d) => ({ kind: 'dispatch' as const, date: d.date, data: d })),
      ...payments.map((p) => ({ kind: 'payment' as const, date: p.date, data: p })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    let runBal = 0;
    const statementRows: (string | number)[][] = [
      [companyName, '', '', '', '', '', '', ''],
      ['OFFICIAL STATEMENT OF ACCOUNT', '', '', '', '', '', '', ''],
      ['Party Name:', partyName || '', 'Generated:', dateStamp, '', '', '', ''],
      ['Contact:', party?.contactPerson || '', 'Phone:', party?.phone || '', '', '', '', ''],
      ['Address:', party?.address || '', 'NTN:', settings.ntnNumber || '', '', '', '', ''],
      [],
      ['EXECUTIVE SUMMARY', '', '', '', '', '', '', ''],
      ['Delivered Tons', totalTons, 'Total Invoiced (Rs)', totalBilled, 'Total Received (Rs)', totalReceived, 'Net Balance Due (Rs)', netBalance],
      [],
      [
        'Sr #',
        'Date',
        'Transaction Description',
        'Ref / Truck #',
        'Weight (Tons)',
        'Rate (Rs/t)',
        'Invoiced Debit (Rs)',
        'Payment Credit (Rs)',
        'Running Balance (Rs)',
        'Remarks',
      ],
    ];

    entries.forEach((e, i) => {
      if (e.kind === 'dispatch') {
        const d = e.data;
        const s = calculateSettlement(d);
        const invoiced = Math.round(s.totalRevenue);
        runBal += invoiced;
        const po = pos.find((p) => p.id === d.poId);

        statementRows.push([
          i + 1,
          d.date || '',
          `Coal Dispatch Delivery (${d.truckNumber})`,
          po?.poNumber || d.truckNumber,
          d.labReceivedWeight || 0,
          parseFloat(s.payableRate.toFixed(2)),
          invoiced,
          0,
          runBal,
          d.notes || '',
        ]);
      } else {
        const p = e.data;
        const isRec = p.type === 'received';
        const amt = Math.round(p.amount);
        if (isRec) runBal -= amt;
        else runBal += amt;

        statementRows.push([
          i + 1,
          p.date || '',
          isRec ? 'Payment Received' : 'Payment Disbursed',
          p.referenceNote || (p.id || '').slice(0, 8).toUpperCase(),
          0,
          0,
          !isRec ? amt : 0,
          isRec ? amt : 0,
          runBal,
          `${p.mode.toUpperCase()} - ${p.referenceNote || ''}`,
        ]);
      }
    });

    statementRows.push([
      'TOTALS',
      '',
      `${dispatches.length} Trucks • ${payments.length} Payments`,
      '',
      parseFloat(totalTons.toFixed(2)),
      '',
      totalBilled,
      totalReceived,
      netBalance,
      '',
    ]);

    const wsStatement = XLSX.utils.aoa_to_sheet(statementRows);
    wsStatement['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 34 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 20 },
      { wch: 20 },
      { wch: 22 },
      { wch: 28 },
    ];
    XLSX.utils.book_append_sheet(wb, wsStatement, 'Statement of Account');

    // ════════════════════════════════════════════════════════════════════════
    // SHEET 2: DISPATCHES & QUALITY
    // ════════════════════════════════════════════════════════════════════════
    const dispatchRows = dispatches
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((d, index) => {
        const po = pos.find((p) => p.id === d.poId);
        const s = calculateSettlement(d);
        const transit = calculateTransitLoss(d);

        return {
          'Sr #': index + 1,
          'Date': d.date || '',
          'Truck Number': d.truckNumber || '',
          'PO #': po?.poNumber || '',
          'Loaded Weight (t)': transit.totalLoadedWeight,
          'Received Weight (t)': d.labReceivedWeight || 0,
          'Transit Difference (t)': transit.diff,
          'Difference %': `${transit.lossPercentage.toFixed(1)}%`,
          'Target GCV': d.targetGcv || 0,
          'Lab Actual GCV': d.labActualGcv || 0,
          'GCV Diff': d.targetGcv && d.labActualGcv ? d.labActualGcv - d.targetGcv : 0,
          'Lab Sulphur (%)': d.labSulphur || 0,
          'Lab Ash (%)': d.labAsh || 0,
          'Lab Moisture (%)': d.labMoisture || 0,
          'Base Rate (Rs)': d.baseRate || 0,
          'GCV Deduction (Rs)': d.manualDeduction || 0,
          'Bonus Premium (Rs)': d.manualPremium || 0,
          'WHT Tax (Rs)': s.taxDeduction ? parseFloat(s.taxDeduction.toFixed(2)) : 0,
          'Payable Rate (Rs)': parseFloat(s.payableRate.toFixed(2)),
          'Gross Invoiced (Rs)': Math.round(s.totalRevenue),
          'Remarks': d.notes || '',
        };
      });

    const wsDispatches = XLSX.utils.json_to_sheet(dispatchRows);
    wsDispatches['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 20 },
      { wch: 28 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDispatches, 'Dispatches & Quality');

    // ════════════════════════════════════════════════════════════════════════
    // SHEET 3: PAYMENT TRANSACTIONS
    // ════════════════════════════════════════════════════════════════════════
    if (payments.length > 0) {
      const paymentRows = payments
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((p, index) => ({
          'Sr #': index + 1,
          'Date': p.date || '',
          'Voucher Ref': (p.id || '').slice(0, 8).toUpperCase(),
          'Direction': p.type === 'received' ? 'Received from Party (Inflow)' : 'Paid to Party (Outflow)',
          'Payment Mode': p.mode.toUpperCase(),
          'Amount (Rs)': Math.round(p.amount),
          'Reference Note': p.referenceNote || 'Direct Settlement',
        }));

      const wsPayments = XLSX.utils.json_to_sheet(paymentRows);
      wsPayments['!cols'] = [
        { wch: 6 },
        { wch: 14 },
        { wch: 16 },
        { wch: 28 },
        { wch: 16 },
        { wch: 20 },
        { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(wb, wsPayments, 'Payment History');
    }
  } else {
    // ════════════════════════════════════════════════════════════════════════
    // FLEET / ALL DISPATCHES EXPORT (Multi-sheet)
    // ════════════════════════════════════════════════════════════════════════
    const sortedDispatches = [...dispatches].sort((a, b) => b.date.localeCompare(a.date));

    // Sheet 1: Master Dispatches
    const masterRows = sortedDispatches.map((d, index) => {
      const p = parties.find((partyItem) => partyItem.id === d.partyId);
      const po = pos.find((poItem) => poItem.id === d.poId);
      const s = calculateSettlement(d);
      const transit = calculateTransitLoss(d);

      return {
        'Sr #': index + 1,
        'Date': d.date || '',
        'Truck Number': d.truckNumber || '',
        'Party / Factory': p?.name || d.factoryName || '',
        'PO Number': po?.poNumber || '',
        'Loaded Tons': transit.totalLoadedWeight,
        'Received Tons': d.labReceivedWeight || 0,
        'Transit Difference (t)': transit.diff,
        'Target GCV': d.targetGcv || 0,
        'Actual Lab GCV': d.labActualGcv || 0,
        'Lab Ash %': d.labAsh || 0,
        'Lab Moisture %': d.labMoisture || 0,
        'Lab Sulphur %': d.labSulphur || 0,
        'Base Rate (Rs/t)': d.baseRate || 0,
        'Deduction (Rs)': d.manualDeduction || 0,
        'Premium (Rs)': d.manualPremium || 0,
        'Payable Rate (Rs/t)': parseFloat(s.payableRate.toFixed(2)),
        'Total Revenue (Rs)': Math.round(s.totalRevenue),
        'Total Cost (Rs)': Math.round(s.totalCost),
        'Net Profit (Rs)': Math.round(s.netProfit),
        'Margin %': s.totalRevenue > 0 ? `${((s.netProfit / s.totalRevenue) * 100).toFixed(1)}%` : '0%',
        'Notes': d.notes || '',
      };
    });

    const wsMaster = XLSX.utils.json_to_sheet(masterRows);
    wsMaster['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 16 },
      { wch: 28 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(wb, wsMaster, 'Dispatches Master');

    // Sheet 2: Cost & Margin Breakdown
    const costRows = sortedDispatches.map((d, index) => {
      const p = parties.find((partyItem) => partyItem.id === d.partyId);
      const s = calculateSettlement(d);
      const blendsStr = (d.coalInputs || [])
        .filter((c) => (c.weight || 0) > 0)
        .map((c) => `${c.sourceName}: ${c.weight}t @ Rs.${c.purchaseRate}`)
        .join(' | ');

      return {
        'Sr #': index + 1,
        'Date': d.date || '',
        'Truck Number': d.truckNumber || '',
        'Party': p?.name || d.factoryName || '',
        'Weight (Tons)': d.labReceivedWeight || 0,
        'Coal Sourcing Blends': blendsStr,
        'Freight Overheads (Rs)': d.overheads?.freight || 0,
        'Loading Overheads (Rs)': d.overheads?.loading || 0,
        'Total Procurement Cost (Rs)': Math.round(s.totalCost),
        'Gross Billed Revenue (Rs)': Math.round(s.totalRevenue),
        'Net Trading Profit (Rs)': Math.round(s.netProfit),
        'Profit / Ton (Rs)': d.labReceivedWeight > 0 ? Math.round(s.netProfit / d.labReceivedWeight) : 0,
      };
    });

    const wsCost = XLSX.utils.json_to_sheet(costRows);
    wsCost['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 16 },
      { wch: 26 },
      { wch: 14 },
      { wch: 34 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
      { wch: 20 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, wsCost, 'Cost & Profit Analysis');

    // Sheet 3: Party Summary
    const partyMap: { [id: string]: { name: string; trucks: number; tons: number; revenue: number; cost: number; profit: number } } = {};
    dispatches.forEach((d) => {
      const p = parties.find((partyItem) => partyItem.id === d.partyId);
      const pName = p?.name || d.factoryName || 'Unspecified';
      if (!partyMap[pName]) {
        partyMap[pName] = { name: pName, trucks: 0, tons: 0, revenue: 0, cost: 0, profit: 0 };
      }
      const s = calculateSettlement(d);
      partyMap[pName].trucks += 1;
      partyMap[pName].tons += d.labReceivedWeight || 0;
      partyMap[pName].revenue += s.totalRevenue;
      partyMap[pName].cost += s.totalCost;
      partyMap[pName].profit += s.netProfit;
    });

    const partySummaryRows = Object.values(partyMap).map((pm, idx) => ({
      'Sr #': idx + 1,
      'Party / Consignee': pm.name,
      'Total Trucks': pm.trucks,
      'Total Delivered Tons': parseFloat(pm.tons.toFixed(2)),
      'Total Gross Revenue (Rs)': Math.round(pm.revenue),
      'Total Procurement Cost (Rs)': Math.round(pm.cost),
      'Net Profit (Rs)': Math.round(pm.profit),
      'Avg Rate / Ton (Rs)': pm.tons > 0 ? Math.round(pm.revenue / pm.tons) : 0,
      'Margin %': pm.revenue > 0 ? `${((pm.profit / pm.revenue) * 100).toFixed(1)}%` : '0%',
    }));

    const wsParty = XLSX.utils.json_to_sheet(partySummaryRows);
    wsParty['!cols'] = [
      { wch: 6 },
      { wch: 28 },
      { wch: 14 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
      { wch: 18 },
      { wch: 16 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsParty, 'Party Summary');
  }

  const base64Xlsx = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const safeName = (partyName || 'All_Dispatches').replace(/[^a-zA-Z0-9_-]/g, '_');
  const finalFileName = options.fileName || `Ledger-${safeName}-${dateStamp}.xlsx`;

  await shareBase64File({
    data: base64Xlsx,
    fileName: finalFileName,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    title: `Factory Ledger - ${partyName || 'All Dispatches'}`,
    text: `Factory Ledger Excel Workbook (${dispatches.length} dispatches).`,
    dialogTitle: 'Share Excel Spreadsheet',
  });
}

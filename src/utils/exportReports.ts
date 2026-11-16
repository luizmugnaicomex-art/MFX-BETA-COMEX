import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  CashFlowEntry,
  OrderStatusMatrixData,
  PartnerScorecard,
  ShipmentProcessRow,
  SwotData,
} from '../types/comex';
import { formatCurrency, formatDateBr } from './sapParser';
import { RAW_SEED_RECORDS_FOR_TEMPLATE } from '../data/mfxSeedData';

export function exportShipmentsWorkbook(processes: ShipmentProcessRow[]): void {
  const superHeaders = [
    'IDENTIFICATION', '', '', '', '', '', '',
    'PROCESSO (Agente de Carga)', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    'PRE ALERT + ORIGINAIS (Despachante)', '', '', '', '', '', '', '', '', '', '', '', '', '',
    'EMBARQUE (Agente de Carga)', '', '', '', '', '', '', '',
    'REGISTRO | DESEMBARAÇO (Despachante)', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    'ESTADIA (Transp+Arm) & TIME', '', '', '', '', '', '',
    'CUSTOS | PAGAMENTOS & STATUS', '', '', '', '', '', '', '', '', '', '', '', '',
  ];

  const colHeaders = [
    // IDENTIFICATION (7)
    'RESP', 'Ref #', 'Exporter', 'Linha', 'PI', 'PO', 'AC',
    // PROCESSO (16)
    'Agente Carga', 'Ptax', 'Freight Cost', 'BRL Frete', 'BL/AWB', 'Master', 'Modal', 'Incoterm',
    'CNTR', 'SEAL', "20'", "40'", 'Inv/Pck', 'Orig. BL', 'Reg Trib', 'AC Sub',
    // PRE ALERT + ORIGINAIS (14)
    'IE', 'Broker', 'Valor', 'Pre-Alert', 'DI draft', 'Ptax PA', 'Invoice Value', 'Moeda',
    'MIRO', 'BRL Invoice', 'Paid', 'Tracking #', 'Doc Broker', 'BL Broker',
    // EMBARQUE (8)
    'From', 'ETD', 'Transshipment', 'Port', 'Trans. ETA', 'Trans. ETD', 'ETA', 'ETA Factory',
    // REGISTRO | DESEMBARAÇO (20)
    'Berthing', 'Terminal', 'Presença', 'Numerario', 'Valor ADT', 'Registro', 'DI #', 'Ptax DI',
    'Impostos', 'AFRMM', 'ECOTAX', 'Canal', 'DES | CI', 'Espelho', 'Minuta', 'NF', 'NF#',
    'Transportadora', 'Frete Nac', 'Recebimento',
    // ESTADIA & TIME (7)
    'Days', 'Periodos', 'Armazenagem', 'Dev. CTNR', 'Demurrage', 'T.T', 'Lead',
    // CUSTOS | PAGAMENTOS & STATUS (13)
    'Warehouse', 'Trucking', 'Broker', 'Freight', 'LI', 'Demurrage Cost', 'Cost (BRL)',
    'R$ CIF', 'R$ FOB', 'USD FOB', '% (Cost/CIF)', '% (Cost/FOB)', 'STATUS',
  ];

  const dataRows = processes.map((p) => [
    p.resp, p.ref, p.exporter, p.linha, p.pi, p.poList, p.ac,
    p.agenteCarga, p.ptax, p.freightCost, p.brlFrete, p.blAwb, p.master, p.modal, p.incoterm,
    p.cntr, p.seal, p.c20, p.c40, p.invPck, p.origBl, p.regTrib, p.acSub,
    p.ie, p.broker, p.valorPreAlert, p.preAlert, p.diDraft, p.ptaxPreAlert, p.invoiceValue, p.currency,
    p.miro, p.brlInvoice, p.paid, p.trackingNum, p.docBroker, p.blBroker,
    p.fromPort, p.etd, p.transshipment, p.transPort, p.transEta, p.transEtd, p.eta, p.etaFactory,
    p.berthing, p.terminal, p.presenca, p.numerario, p.valorAdt, p.registro, p.diNum, p.ptaxDi,
    p.impostos, p.afrmm, p.ecotax, p.canal, p.desCi, p.espelho, p.minuta, p.nfStatus, p.nfNum,
    p.transportadora, p.freteNac, p.recebimento,
    p.days, p.periodos, p.armazenagem, p.devCtnr, p.demurrage, p.transitTime, p.leadTime,
    p.warehouse, p.trucking, p.brokerFee, p.freightTotal, p.liFee, p.demurrageTotal, p.totalCostBrl,
    p.brlCif, p.brlFob, p.usdFob, p.pctCostCif, p.pctCostFob, p.status,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([superHeaders, colHeaders, ...dataRows]);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 0, c: 7 }, e: { r: 0, c: 22 } },
    { s: { r: 0, c: 23 }, e: { r: 0, c: 36 } },
    { s: { r: 0, c: 37 }, e: { r: 0, c: 44 } },
    { s: { r: 0, c: 45 }, e: { r: 0, c: 64 } },
    { s: { r: 0, c: 65 }, e: { r: 0, c: 71 } },
    { s: { r: 0, c: 72 }, e: { r: 0, c: 84 } },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Processos');
  XLSX.writeFile(wb, 'SHIPMENTS_COMEX_MFX.xlsx');
}

export function exportOrderStatusMatrix(
  matrix: OrderStatusMatrixData,
  qtdAcOverrides: Record<string, number>
): void {
  const aoa: (string | number)[][] = [];
  const colCount = 7 + matrix.columns.length + 1;

  // Top 6 metadata header rows (Cols A-F blank, Col G labels, Cols H+ dynamic PO/BL, final col blank/QTD AC)
  const makeMetaRow = (label: string, getter: (c: typeof matrix.columns[0]) => string | number, lastCol = '') => [
    '', '', '', '', '', '', label,
    ...matrix.columns.map(getter),
    lastCol,
  ];

  aoa.push(makeMetaRow('N#', (c) => `${c.kind}: ${c.number}`));
  aoa.push(makeMetaRow('Supplier', (c) => c.supplier));
  aoa.push(makeMetaRow('Payment', (c) => c.payment));
  aoa.push(makeMetaRow('Adv Value', (c) => `${c.currency} ${c.advValue.toFixed(2)}`));
  aoa.push(makeMetaRow('ETD', (c) => c.etd));
  aoa.push(makeMetaRow('ETA', (c) => c.eta));

  // Table header row (Row 7)
  aoa.push([
    'COD. MATERIAL',
    'DESCRIÇÃO MATERIAL - PT',
    'DESCRIÇÃO MATERIAL - ENG',
    'NCM',
    'UM',
    'Estoque',
    'TIPO',
    ...matrix.columns.map((c) => `${c.kind} ${c.number}`),
    'QTD AC',
  ]);

  for (const section of matrix.sections) {
    const sectionRow: (string | number)[] = Array(colCount).fill('');
    sectionRow[0] = `PROJETO: ${section.label}`;
    aoa.push(sectionRow);

    for (const mat of section.materials) {
      const qtdAc = qtdAcOverrides[mat.rowKey] ?? mat.qtdAcDefault;
      aoa.push([
        mat.materialCode,
        mat.descPt,
        mat.descEn,
        mat.ncm,
        mat.um,
        mat.estoque,
        mat.acNumber ? `AC ${mat.acNumber}` : '-',
        ...matrix.columns.map((c) => mat.quantities[c.key] || 0),
        qtdAc,
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Status dos Pedidos');
  XLSX.writeFile(wb, '01_Relatorio_de_Status_dos_Pedidos_MFX.xlsx');
}

export function exportCashFlowExcel(entries: CashFlowEntry[]): void {
  const rows = entries.map((e) => ({
    Origem: e.source,
    Referencia: e.reference,
    'Processo MFX': e.processRef,
    Parceiro: e.partner,
    Documento: e.documentNumber,
    Categoria: e.category,
    'Data Emissão': formatDateBr(e.issueDate),
    Vencimento: formatDateBr(e.dueDate),
    'Data Liquidação': formatDateBr(e.clearingDate),
    'Doc Compensação': e.clearingDoc || '-',
    Moeda: e.currency,
    'Valor Original': e.amount,
    'Valor (BRL)': Math.round(e.amountBrl * 100) / 100,
    Status: e.status,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cash Flow Comex');
  XLSX.writeFile(wb, 'MFX_Comex_Cash_Flow_Report.xlsx');
}

export function exportCashFlowPdf(entries: CashFlowEntry[]): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.text('MFX Intelligent Comex — Financial Cash Flow Report', 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated on ${new Date().toLocaleDateString('pt-BR')} · Total Records: ${entries.length}`, 40, 56);

  const totalPaid = entries.filter((e) => e.status === 'PAGO').reduce((s, e) => s + e.amountBrl, 0);
  const totalUpcoming = entries.filter((e) => e.status !== 'PAGO').reduce((s, e) => s + e.amountBrl, 0);
  doc.text(
    `Settled (Pago): ${formatCurrency(totalPaid, 'BRL')}   |   Upcoming / Open / Projected: ${formatCurrency(totalUpcoming, 'BRL')}`,
    40,
    72
  );

  autoTable(doc, {
    startY: 88,
    head: [['Ref / MFX', 'Partner', 'Category', 'Document', 'Due Date', 'Original', 'Amount (BRL)', 'Status']],
    body: entries.map((e) => [
      `${e.reference}${e.processRef !== '-' ? ` (${e.processRef})` : ''}`,
      e.partner,
      e.category,
      e.documentNumber,
      formatDateBr(e.dueDate),
      formatCurrency(e.amount, e.currency),
      formatCurrency(e.amountBrl, 'BRL'),
      e.status,
    ]),
    styles: { fontSize: 7.5, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
  });

  doc.save('MFX_Comex_Cash_Flow_Report.pdf');
}

export function exportSwotPdf(partner: PartnerScorecard, swot: SwotData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  doc.setFontSize(15);
  doc.text(`MFX Comex — 360° Partner SWOT Dossier`, 40, 42);
  doc.setFontSize(11);
  doc.text(`${partner.name} (${partner.category})`, 40, 62);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(
    `Processes/POs: ${partner.poOrProcessCount}  |  On-Time: ${partner.onTimeRate}%  |  Avg Delay: ${partner.avgDelayDays}d  |  Volume (BRL): ${formatCurrency(partner.totalValueBrl, 'BRL')}`,
    40,
    78
  );

  const quadrants: Array<[string, string[]]> = [
    ['STRENGTHS (Forças)', swot.strengths],
    ['WEAKNESSES (Fraquezas)', swot.weaknesses],
    ['OPPORTUNITIES (Oportunidades)', swot.opportunities],
    ['THREATS (Ameaças)', swot.threats],
  ];

  autoTable(doc, {
    startY: 96,
    head: [['Quadrant', 'Strategic & Data-Driven Insights']],
    body: quadrants.map(([title, list]) => [title, list.map((b) => `• ${b}`).join('\n')]),
    styles: { fontSize: 9, cellPadding: 8 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    columnStyles: { 0: { cellWidth: 160, fontStyle: 'bold' } },
  });

  doc.save(`MFX_SWOT_${partner.name.replace(/[^a-z0-9]/gi, '_')}.pdf`);
}

export function downloadSampleFupTemplate(): void {
  const ws = XLSX.utils.json_to_sheet(RAW_SEED_RECORDS_FOR_TEMPLATE);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'comex FUP');
  XLSX.writeFile(wb, 'FUP COMEX.xlsx');
}

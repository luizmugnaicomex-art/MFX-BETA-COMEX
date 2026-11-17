import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  CashFlowEntry,
  MaterialProcurementItem,
  NumerarioAnalysisResult,
  OrderStatusMatrixData,
  PartnerScorecard,
  ShipmentProcessRow,
  ShipmentWorthinessAnalysisResult,
  SimilarMaterialGroup,
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

export function buildOrderStatusMatrixAoa(
  matrix: OrderStatusMatrixData,
  qtdAcOverrides: Record<string, number>
): (string | number)[][] {
  const aoa: (string | number)[][] = [];

  // Top 8 metadata header rows (Cols A-G blank, Col H labels, Cols I+ dynamic PO/BL, final col blank/QTD AC)
  const makeMetaRow = (label: string, getter: (c: typeof matrix.columns[0]) => string | number, lastCol = '') => [
    '', '', '', '', '', '', '', label,
    ...matrix.columns.map(getter),
    lastCol,
  ];

  aoa.push(makeMetaRow('N#', (c) => `${c.kind}: ${c.number}`));
  aoa.push(makeMetaRow('PO #', (c) => c.poNumbers));
  aoa.push(makeMetaRow('BL / AWB', (c) => c.blAwb));
  aoa.push(makeMetaRow('NF (DOCNUM)', (c) => c.nfDocnum));
  aoa.push(makeMetaRow('Supplier', (c) => c.supplier));
  aoa.push(makeMetaRow('Payment', (c) => c.payment));
  aoa.push(makeMetaRow('Adv Value', (c) => `${c.currency} ${c.advValue.toFixed(2)}`));
  aoa.push(makeMetaRow('ETD', (c) => c.etd));
  aoa.push(makeMetaRow('ETA', (c) => c.eta));

  // Table header row (Row 9)
  aoa.push([
    'COD. MATERIAL',
    'DESCRIÇÃO MATERIAL - PT',
    'DESCRIÇÃO MATERIAL - ENG',
    'NCM',
    'UM',
    'Estoque',
    'PEP',
    'TIPO',
    ...matrix.columns.map((c) => `${c.kind} ${c.number}`),
    'QTD AC',
  ]);

  for (const section of matrix.sections) {
    for (const mat of section.materials) {
      const qtdAc = qtdAcOverrides[mat.rowKey] ?? mat.qtdAcDefault;
      aoa.push([
        mat.materialCode,
        mat.descPt,
        mat.descEn,
        mat.ncm,
        mat.um,
        mat.estoque,
        mat.elementoPep && mat.elementoPep !== '-' ? mat.elementoPep : '',
        mat.acNumber ? `AC ${mat.acNumber}` : '-',
        ...matrix.columns.map((c) => mat.quantities[c.key] || 0),
        qtdAc,
      ]);
    }
  }

  return aoa;
}

export function exportOrderStatusMatrix(
  matrix: OrderStatusMatrixData,
  qtdAcOverrides: Record<string, number>
): void {
  const aoa = buildOrderStatusMatrixAoa(matrix, qtdAcOverrides);
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

export function exportPqrWorkbook(materials: MaterialProcurementItem[]): void {
  const rows = materials.map((m) => ({
    'Material Code': m.materialCode,
    'Description (PT)': m.descPt,
    'Description (EN)': m.descEn,
    NCM: m.ncm,
    UM: m.unit,
    'PQR Class': m.pqrClass,
    'ABC Spend Class': m.abcClass,
    'PO Count': m.poCount,
    'Ordered Qty': m.totalOrderedQty,
    'Received Qty (MIGO)': m.totalReceivedQty,
    'Plant 0003 Stock': m.totalStockPlant0003,
    'Pending Qty': m.totalPendingQty,
    'Avg Unit Cost (BRL)': Math.round(m.avgUnitPriceBrl * 100) / 100,
    'Total Spend (BRL)': Math.round(m.totalSpendBrl * 100) / 100,
    'Spend Share (%)': m.spendSharePct,
    Suppliers: m.suppliers.join(', '),
    'PO Numbers': m.poNumbers.join(', '),
    'MFX Processes': m.processRefs.join(', ') || '-',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PQR Control');
  XLSX.writeFile(wb, 'MFX_PQR_Control_Report.xlsx');
}

export function exportKraljicWorkbook(materials: MaterialProcurementItem[]): void {
  const rows = materials.map((m) => ({
    'Material Code': m.materialCode,
    'Description (PT)': m.descPt,
    NCM: m.ncm,
    'Kraljic Quadrant': m.kraljicQuadrant,
    'Computed Quadrant': m.computedQuadrant,
    'Profit Impact Score (0-100)': m.profitImpactScore,
    'Supply Risk Score (0-100)': m.supplyRiskScore,
    'Risk Drivers': m.riskDrivers.join(' | ') || 'Low operational friction',
    'Total Spend (BRL)': Math.round(m.totalSpendBrl * 100) / 100,
    'Spend Share (%)': m.spendSharePct,
    'Avg Unit Cost (BRL)': Math.round(m.avgUnitPriceBrl * 100) / 100,
    'Ordered Qty': m.totalOrderedQty,
    'Used / Stock Qty': m.effectiveUsageQty,
    'Suppliers Count': m.suppliers.length,
    Suppliers: m.suppliers.join(', '),
    'Recommended Strategy': m.recommendedStrategy,
    'Procurement Notes': m.overrideNote || '-',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kraljic Matrix');
  XLSX.writeFile(wb, 'MFX_Kraljic_Matrix_Report.xlsx');
}

export function exportSimilarItemsWorkbook(groups: SimilarMaterialGroup[]): void {
  const rows = groups.flatMap((g, groupIdx) =>
    g.materials.map((m) => ({
      'Cluster #': groupIdx + 1,
      'Cluster ID': g.groupId,
      'Similarity (%)': g.maxSimilarity,
      'Match Tier': g.tier,
      'Audit Status': g.auditStatus,
      'Primary Code': g.primaryMaterialCode,
      'Material Code': m.materialCode,
      'Description (PT)': m.descPt,
      'Description (EN)': m.descEn,
      NCM: m.ncm,
      Unit: m.unit,
      'PO Count': m.poCount,
      'Bought Qty': m.totalOrderedQty,
      'Used / Stock Qty': m.effectiveUsageQty,
      'Plant 0003 Stock': m.totalStockPlant0003,
      'Avg Unit Cost (BRL)': Math.round(m.avgUnitPriceBrl * 100) / 100,
      'Cluster Price Spread (%)': g.unitPriceSpreadPct,
      'Total Spend (BRL)': Math.round(m.totalSpendBrl * 100) / 100,
      Suppliers: m.suppliers.join(', '),
      'PO Numbers': m.poNumbers.join(', '),
      'Match Reasons': g.matchReasons.join(' | '),
      'Spec Differences': g.specDifferences.join(' | ') || '-',
      'Audit Note': g.auditNote || '-',
    }))
  );
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Similar Items Audit');
  XLSX.writeFile(wb, 'MFX_Similar_Items_Audit.xlsx');
}

export function exportNumerarioWorkbook(analysis: NumerarioAnalysisResult): void {
  const rows = analysis.rows.map((r) => ({
    'Process / Ref': r.id,
    Type: r.kind === 'SHIPMENT' ? 'MFX Shipment' : 'Open PO Forecast',
    'PO Numbers': r.poList,
    'DI #': r.diNum,
    'Data DI': r.dataDi,
    Supplier: r.supplier,
    'Project / PEP': r.pepProject,
    NCMs: r.ncms,
    'Ato Concessório': r.acNumber,
    'Tax Regime': r.taxRegime,
    'Calculation Basis': r.sourceType,
    Modal: r.modal,
    Incoterm: r.incoterm,
    'FOB Orig': r.fobOrig,
    Currency: r.currency,
    PTAX: r.ptax,
    'Valor Aduaneiro (BRL)': r.valorAduaneiroBrl,
    'II (BRL)': r.iiBrl,
    'IPI (BRL)': r.ipiBrl,
    'PIS (BRL)': r.pisBrl,
    'COFINS (BRL)': r.cofinsBrl,
    'ICMS (BRL)': r.icmsBrl,
    'Siscomex (BRL)': r.siscomexBrl,
    'AFRMM (BRL)': r.afrmmBrl,
    'Total Taxes (BRL)': r.totalTaxesBrl,
    'Armazenagem (BRL)': r.armazenagemBrl,
    'Capatazia (BRL)': r.capataziaBrl,
    'Broker Fee (BRL)': r.brokerFeeBrl,
    'LI Fee (BRL)': r.liFeeBrl,
    'Frete Nacional (BRL)': r.freteNacionalBrl,
    'Demurrage (BRL)': r.demurrageBrl,
    'Total Port & Clearance (BRL)': r.totalClearanceExpensesBrl,
    'Total Numerário (BRL)': r.totalNumerarioBrl,
    'Valor Adiantado (BRL)': r.valorAdiantadoBrl,
    'Saldo Financeiro (BRL)': r.saldoFinanceiroBrl,
    'Drawback Savings / Exposure (BRL)': r.potentialDrawbackSavingsBrl,
    'Data Sol. Numerário': r.numerarioRequestDate,
    'Finance Status': r.financeStatus,
    'Finance Note': r.financeNote || '-',
  }));

  rows.push({
    'Process / Ref': 'TOTAL',
    Type: 'SUMMARY',
    'PO Numbers': `${analysis.counts.totalRows} items`,
    'DI #': '-',
    'Data DI': '-',
    Supplier: '-',
    'Project / PEP': '-',
    NCMs: '-',
    'Ato Concessório': '-',
    'Tax Regime': 'DRAWBACK_SUSP',
    'Calculation Basis': 'SAP_DI',
    Modal: '-',
    Incoterm: '-',
    'FOB Orig': 0,
    Currency: 'BRL',
    PTAX: 0,
    'Valor Aduaneiro (BRL)': analysis.totals.valorAduaneiroBrl,
    'II (BRL)': analysis.totals.iiBrl,
    'IPI (BRL)': analysis.totals.ipiBrl,
    'PIS (BRL)': analysis.totals.pisBrl,
    'COFINS (BRL)': analysis.totals.cofinsBrl,
    'ICMS (BRL)': analysis.totals.icmsBrl,
    'Siscomex (BRL)': analysis.totals.siscomexBrl,
    'AFRMM (BRL)': analysis.totals.afrmmBrl,
    'Total Taxes (BRL)': analysis.totals.totalTaxesBrl,
    'Armazenagem (BRL)': 0,
    'Capatazia (BRL)': 0,
    'Broker Fee (BRL)': 0,
    'LI Fee (BRL)': 0,
    'Frete Nacional (BRL)': 0,
    'Demurrage (BRL)': 0,
    'Total Port & Clearance (BRL)': analysis.totals.totalClearanceExpensesBrl,
    'Total Numerário (BRL)': analysis.totals.totalNumerarioBrl,
    'Valor Adiantado (BRL)': analysis.totals.valorAdiantadoBrl,
    'Saldo Financeiro (BRL)': analysis.totals.saldoFinanceiroBrl,
    'Drawback Savings / Exposure (BRL)':
      analysis.totals.drawbackSavedBrl + analysis.totals.potentialSavingsIfAcLinkedBrl,
    'Data Sol. Numerário': '-',
    'Finance Status': 'APPROVED',
    'Finance Note': '-',
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Numerario Costs');
  XLSX.writeFile(wb, 'MFX_Numerario_Costs_Finance.xlsx');
}

export function exportNumerarioPdf(analysis: NumerarioAnalysisResult): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.text('MFX Intelligent Comex — Numerário & Customs Declaration Cost Forecast', 40, 38);
  doc.setFontSize(9);
  doc.setTextColor(95);
  doc.text(
    `Generated on ${new Date().toLocaleDateString('pt-BR')}  ·  Items: ${analysis.counts.totalRows}  |  Total Expected Numerário: ${formatCurrency(analysis.totals.totalNumerarioBrl, 'BRL')}  |  Saldo a Complementar: ${formatCurrency(analysis.totals.saldoFinanceiroBrl, 'BRL')}`,
    40,
    54
  );

  autoTable(doc, {
    startY: 70,
    head: [
      [
        'Process / PO',
        'Regime / Basis',
        'VA (BRL)',
        'II',
        'IPI',
        'PIS',
        'COFINS',
        'ICMS',
        'Siscomex/AFRMM',
        'Port/Broker',
        'Total Numerário',
        'Adiantado',
        'Saldo',
      ],
    ],
    body: [
      ...analysis.rows.map((r) => [
        `${r.id}\nPO ${r.poList}`,
        `${r.taxRegime === 'DRAWBACK_SUSP' ? 'DBK Susp.' : r.taxRegime === 'AGUARDANDO_AC' ? 'Aguard. AC' : 'Rec. Int.'}\n(${r.sourceType === 'SAP_DI' ? 'SAP DI' : r.sourceType === 'DRAWBACK_SUSPENDED' ? 'AC SAP' : r.sourceType === 'SIMULATED' ? 'Sim.' : 'Pre-DI'})`,
        formatCurrency(r.valorAduaneiroBrl, 'BRL'),
        formatCurrency(r.iiBrl, 'BRL'),
        formatCurrency(r.ipiBrl, 'BRL'),
        formatCurrency(r.pisBrl, 'BRL'),
        formatCurrency(r.cofinsBrl, 'BRL'),
        formatCurrency(r.icmsBrl, 'BRL'),
        formatCurrency(r.siscomexBrl + r.afrmmBrl, 'BRL'),
        formatCurrency(r.totalClearanceExpensesBrl, 'BRL'),
        formatCurrency(r.totalNumerarioBrl, 'BRL'),
        formatCurrency(r.valorAdiantadoBrl, 'BRL'),
        formatCurrency(r.saldoFinanceiroBrl, 'BRL'),
      ]),
      [
        'TOTAL',
        `${analysis.counts.totalRows} lines`,
        formatCurrency(analysis.totals.valorAduaneiroBrl, 'BRL'),
        formatCurrency(analysis.totals.iiBrl, 'BRL'),
        formatCurrency(analysis.totals.ipiBrl, 'BRL'),
        formatCurrency(analysis.totals.pisBrl, 'BRL'),
        formatCurrency(analysis.totals.cofinsBrl, 'BRL'),
        formatCurrency(analysis.totals.icmsBrl, 'BRL'),
        formatCurrency(analysis.totals.siscomexBrl + analysis.totals.afrmmBrl, 'BRL'),
        formatCurrency(analysis.totals.totalClearanceExpensesBrl, 'BRL'),
        formatCurrency(analysis.totals.totalNumerarioBrl, 'BRL'),
        formatCurrency(analysis.totals.valorAdiantadoBrl, 'BRL'),
        formatCurrency(analysis.totals.saldoFinanceiroBrl, 'BRL'),
      ],
    ],
    styles: { fontSize: 7, cellPadding: 3.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
  });

  doc.save('MFX_Numerario_Costs_Finance.pdf');
}

export function exportWorthinessWorkbook(analysis: ShipmentWorthinessAnalysisResult): void {
  const shipmentRows = analysis.rows.map((r) => ({
    'Process / Ref': r.ref,
    'PO Numbers': r.poList,
    Exporter: r.exporter,
    'Project / PEP': r.pepProject,
    Modal: r.modal,
    Incoterm: r.incoterm,
    Status: r.status,
    Channel: r.canal,
    'Worthiness Verdict':
      r.worthinessVerdict === 'NOT_WORTH_IT'
        ? 'Cost Overrun (Review/Avoid)'
        : r.worthinessVerdict === 'REVIEW'
          ? 'Borderline / Review'
          : 'Worth It / Efficient',
    'Air Modal Verdict': r.airEvaluation.isAir ? r.airEvaluation.headline : r.modal,
    'Order FOB (BRL)': r.fobBrl,
    'Intl Freight (BRL)': r.intlFreightBrl,
    'Freight % of FOB': r.freightPctOverFob,
    'Storage & Capatazia (BRL)': Math.round((r.storageBrl + r.capataziaBrl) * 100) / 100,
    'Storage Days': r.daysInPort,
    'Storage Periods': r.periodos,
    'Demurrage (BRL)': r.demurrageBrl,
    'Customs Taxes SAP (BRL)': r.customsTaxesBrl,
    'Total Logistics & Port (BRL)': r.totalLogisticsCostBrl,
    'Logistics % of FOB': r.logisticsPctOverFob,
    'Total Extra Cost (BRL)': r.totalExtraCostBrl,
    'Extra Cost % of FOB': r.totalExtraPctOverFob,
    'Total Landed Cost (BRL)': r.totalLandedBrl,
    'Landed Multiplier (x)': r.landedMultiplier,
    'Observed Excess Storage/Demurrage (BRL)': r.observedAvoidableWasteBrl,
    'Key Verdict Reasons': r.worthinessReasons.join(' | '),
    'SKU Trouble Signals': r.itemTroubleSummary.troubleSignals.join(' | ') || '-',
    'Director Cost-Avoidance Actions':
      r.recommendations.map((a) => `${a.title} (${a.detail})`).join(' || ') || '-',
  }));

  const troubleRows = analysis.materialTroubles.map((m) => ({
    'Material Code': m.materialCode,
    'Description (PT)': m.descPt,
    'Description (EN)': m.descEn,
    NCM: m.ncm,
    'Primary Supplier': m.primarySupplier,
    'Severity': m.severity,
    'Total POs': m.orderCount,
    'Late POs': m.lateOrderCount,
    'Late Rate (%)': m.delayedRatePct,
    'Max Delay (Days)': m.maxDelayDays,
    'Air Shipments': m.airShipmentCount,
    'Sea Shipments': m.seaShipmentCount,
    'Missing AC Lines': m.missingAcCount,
    'Plant 0003 Stock': m.stockPlant0003,
    'Total Spend (BRL)': m.totalSpendBrl,
    'Storage & Demurrage (BRL)': m.totalStorageAndDemurrageBrl,
    'Trouble Signals': m.troubleSignals.join(' | ') || 'On Track',
    'Recommended Fix for Future Orders': m.recommendedFutureFix,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(shipmentRows), 'Shipment ROI Audit');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(troubleRows), 'Recurring SKU Troubles');
  XLSX.writeFile(wb, 'MFX_Shipment_Worthiness_Director_Audit.xlsx');
}

export function exportWorthinessPdf(analysis: ShipmentWorthinessAnalysisResult): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.text('MFX Intelligent Comex — Director Shipment ROI & Cost-Benefit Audit', 40, 38);
  doc.setFontSize(9);
  doc.setTextColor(95);
  doc.text(
    `Generated ${new Date().toLocaleDateString('pt-BR')}  ·  Shipments: ${analysis.summary.totalShipments}  |  Order FOB: ${formatCurrency(analysis.summary.totalFobBrl, 'BRL')}  |  Total Extra Cost: ${formatCurrency(analysis.summary.totalExtraCostBrl, 'BRL')} (${analysis.summary.weightedExtraPctOverFob}%)  |  Overruns: ${analysis.summary.notWorthItCount}`,
    40,
    54
  );

  autoTable(doc, {
    startY: 70,
    head: [
      [
        'Ref / PO',
        'Modal / Air Audit',
        'Order FOB',
        'Logistics',
        'Taxes (SAP)',
        'Extra / FOB %',
        'Verdict',
        'Key Reasons & Prevention',
      ],
    ],
    body: analysis.rows.map((r) => [
      `${r.ref}\n${r.exporter}`,
      `${r.modal}\n${r.airEvaluation.isAir ? r.airEvaluation.headline : `${r.daysInPort}d (${r.periodos}p)`}`,
      formatCurrency(r.fobBrl, 'BRL'),
      formatCurrency(r.totalLogisticsCostBrl, 'BRL'),
      formatCurrency(r.customsTaxesBrl, 'BRL'),
      `+${r.totalExtraPctOverFob}%\n(Log ${r.logisticsPctOverFob}%)`,
      r.worthinessVerdict === 'NOT_WORTH_IT'
        ? 'NOT WORTH IT'
        : r.worthinessVerdict === 'REVIEW'
          ? 'REVIEW'
          : 'WORTH IT',
      `${r.worthinessReasons.join('; ')}${r.recommendations[0] ? `\nFix: ${r.recommendations[0].title}` : ''}`,
    ]),
    styles: { fontSize: 7, cellPadding: 3.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
  });

  doc.save('MFX_Shipment_Worthiness_Director_Audit.pdf');
}





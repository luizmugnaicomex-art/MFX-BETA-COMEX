import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAtoConcessorio,
  normalizeFupRow,
  normalizeNcmList,
  parseExcelDate,
  stripLeadingZeros,
} from './sapParser';
import {
  buildCashFlowData,
  buildMaterialAnalytics,
  buildNumerarioAnalysis,
  buildOrderStatusMatrix,
  buildPartnerScorecards,
  buildShipmentProcesses,
  buildShipmentWorthinessAnalysis,
  calculateBrazilianImportTaxes,
  computeDirectorChartMetrics,
  computeExecutiveKpis,
  detectSimilarMaterials,
  extractAvailableYears,
  filterFupItems,
  parseContainerCounts,
  resolveItemFilterDate,
} from './comexEngine';
import { buildOrderStatusMatrixAoa } from './exportReports';
import type { ComexFilters } from '../types/comex';
import { INITIAL_MFX_SEED_DATA } from '../data/mfxSeedData';

const BASE_FILTERS: ComexFilters = {
  search: '',
  pep: '',
  atoConcessorio: '',
  supplier: '',
  ncm: '',
  buyer: '',
  status: '',
  year: '',
  month: '',
  dateField: 'OPS',
  hideDeleted: true,
};

test('stripLeadingZeros and formatAtoConcessorio handle SAP formatting quirks', () => {
  assert.equal(stripLeadingZeros('000000000030001421'), '30001421');
  assert.equal(formatAtoConcessorio(20240024150), '20240024150');
  assert.equal(formatAtoConcessorio('20260037400.0'), '20260037400');
  assert.equal(formatAtoConcessorio('2.024002415e+10'), '20240024150');
});

test('parseExcelDate converts Excel serial dates, ISO, and BR dates', () => {
  assert.equal(parseExcelDate('2026-03-15'), '2026-03-15');
  assert.equal(parseExcelDate('15/03/2026'), '2026-03-15');
  assert.equal(parseExcelDate(46096), '2026-03-15');
});

test('normalizeFupRow supports raw SAP field names and malformed JSON gracefully', () => {
  const row = normalizeFupRow(
    {
      EBELN: '4500009999',
      EBELP: '10',
      MATNR: '00000012345',
      TXZ01: 'VALVULA SUBMARINA',
      MENGE: 20,
      WEMNG: 5,
      NETWR: 10000,
      WAERS: 'USD',
      LOEKZ: '',
      PROCESSOS_JSON: '{invalid json',
      FINANCEIRO_JSON: '[]',
    },
    0
  );
  assert.equal(row.PEDIDO, '4500009999');
  assert.equal(row.MATERIAL, '12345');
  assert.equal(row.QUANTIDADE_PENDENTE, 15);
  assert.deepEqual(row.processos, []);
});

test('filterFupItems hides deleted SAP items by default and shows when toggled off', () => {
  const visibleDefault = filterFupItems(INITIAL_MFX_SEED_DATA, BASE_FILTERS);
  assert.equal(visibleDefault.length, 7);
  const visibleAll = filterFupItems(INITIAL_MFX_SEED_DATA, {
    ...BASE_FILTERS,
    hideDeleted: false,
  });
  assert.equal(visibleAll.length, 8);
});

test('buildShipmentProcesses aggregates MFX processes and applies operational overrides', () => {
  const active = filterFupItems(INITIAL_MFX_SEED_DATA, BASE_FILTERS);
  const processes = buildShipmentProcesses(active, {
    'MFX-00003/25': { resp: 'MUGNAI', brokerFee: 2500, status: 'PARADO AG. DRAWBACK' },
  });
  assert.equal(processes.length, 5);
  const proc03 = processes.find((p) => p.ref === 'MFX-00003/25');
  assert.ok(proc03);
  assert.equal(proc03.resp, 'MUGNAI');
  assert.equal(proc03.brokerFee, 2500);
  assert.equal(proc03.status, 'PARADO AG. DRAWBACK');
  assert.equal(proc03.canal, 'AMARELO');
});

test('computeExecutiveKpis, OrderStatusMatrix, CashFlow, and PartnerScorecards run cleanly', () => {
  const active = filterFupItems(INITIAL_MFX_SEED_DATA, BASE_FILTERS);
  const processes = buildShipmentProcesses(active, {});
  const kpis = computeExecutiveKpis(active, processes);
  assert.ok(kpis.activePoCount >= 4);
  assert.ok(kpis.ncmSummary.some((n) => n.ncm === '84818099' && n.missingAcAlert));

  const matrix = buildOrderStatusMatrix(active, {});
  assert.ok(matrix.columns.some((c) => c.kind === 'PO'));
  assert.ok(matrix.columns.some((c) => c.kind === 'BL'));
  assert.ok(matrix.sections.length >= 4);

  const cashFlow = buildCashFlowData(active, processes);
  assert.ok(cashFlow.length >= 6);

  const partners = buildPartnerScorecards(active, processes);
  assert.ok(partners.some((p) => p.category === 'SUPPLIER'));
  assert.ok(partners.some((p) => p.category === 'FORWARDER'));
  assert.ok(partners.some((p) => p.category === 'BROKER'));
});

test('buildOrderStatusMatrix generates unique sectionKey and rowKey when PEP descriptions repeat across PEP codes', () => {
  const rowA = normalizeFupRow(
    {
      PEDIDO: '4500002001',
      ITEM_PEDIDO: '10',
      MATERIAL: '30009999',
      DESCRICAO_MATERIAL: 'ENGATE RAPIDO A',
      ELEMENTO_PEP_INTERNO: 'PEP-0100-QC',
      DESCRICAO_ELEMENTO_PEP: 'QUICK COUPLING',
      QUANTIDADE_PEDIDA: 5,
    },
    0
  );
  const rowB = normalizeFupRow(
    {
      PEDIDO: '4500002002',
      ITEM_PEDIDO: '10',
      MATERIAL: '30009999',
      DESCRICAO_MATERIAL: 'ENGATE RAPIDO A',
      ELEMENTO_PEP_INTERNO: 'PEP-0200-QC',
      DESCRICAO_ELEMENTO_PEP: 'QUICK COUPLING',
      QUANTIDADE_PEDIDA: 8,
    },
    1
  );

  const matrix = buildOrderStatusMatrix([rowA, rowB], {});
  assert.equal(matrix.sections.length, 2);
  const sectionKeys = new Set(matrix.sections.map((s) => s.sectionKey));
  assert.equal(sectionKeys.size, 2);
  const rowKeys = new Set(matrix.sections.flatMap((s) => s.materials.map((m) => m.rowKey)));
  assert.equal(rowKeys.size, 2);
  assert.equal(matrix.sections[0].materials[0].elementoPep, 'QUICK COUPLING');
  assert.equal(matrix.sections[0].materials[0].elementoPepCode, 'PEP-0100-QC');
});

test('parseContainerCounts parses multiplier container strings and computeDirectorChartMetrics aggregates KPIs', () => {
  assert.deepEqual(parseContainerCounts('2x40HC'), { c20: 0, c40: 2 });
  assert.deepEqual(parseContainerCounts("3 x 20' DV"), { c20: 3, c40: 0 });
  assert.deepEqual(parseContainerCounts('1x20 + 2x40HQ'), { c20: 1, c40: 2 });
  assert.deepEqual(parseContainerCounts('20 DV'), { c20: 1, c40: 0 });
  assert.deepEqual(parseContainerCounts('LCL/AIR'), { c20: 0, c40: 0 });

  const active = filterFupItems(INITIAL_MFX_SEED_DATA, BASE_FILTERS);
  const processes = buildShipmentProcesses(active, {});
  const metrics = computeDirectorChartMetrics(processes);

  assert.equal(metrics.totalProcesses, 5);
  assert.equal(
    metrics.channelBreakdown.reduce((sum, ch) => sum + ch.count, 0),
    metrics.totalProcesses
  );
  assert.equal(
    metrics.processPipeline.reduce((sum, st) => sum + st.count, 0),
    metrics.totalProcesses
  );
  assert.equal(
    metrics.containerAndModal.totalTeus,
    metrics.containerAndModal.total20 + metrics.containerAndModal.total40 * 2
  );
  assert.ok(metrics.timingMetrics.avgTransitDays > 0);
  assert.equal(metrics.timingMetrics.perProcess.length, 5);
});

test('normalizeNcmList, formatAtoConcessorio, and filterFupItems handle real SAP quirks and SEM NCM clicks', () => {
  assert.equal(normalizeNcmList('7217.20.10, 7217.20.10, 7217.20.10'), '7217.20.10');
  assert.equal(normalizeNcmList('00000000'), '');
  assert.equal(normalizeNcmList('8481.80.99, 7307.29.00, 8481.80.99'), '8481.80.99, 7307.29.00');

  assert.equal(formatAtoConcessorio('00000000000'), '');
  assert.equal(formatAtoConcessorio('00000000000, 20260037354'), '20260037354');
  assert.equal(formatAtoConcessorio('00020260023'), '20260023');

  const noNcmRow = normalizeFupRow(
    {
      PEDIDO: '4500003001',
      ITEM_PEDIDO: '10',
      MATERIAL: '10001',
      DESCRICAO_MATERIAL: 'ITEM SEM NCM',
      FUP_NCMS: '',
      FUP_ATO_CONCESSORIO: '00000000000',
      QUANTIDADE_PEDIDA: 100,
      QUANTIDADE_PENDENTE: -153,
      VALOR_LIQUIDO: 5000,
    },
    0
  );
  const multiNcmRow = normalizeFupRow(
    {
      PEDIDO: '4500003002',
      ITEM_PEDIDO: '10',
      MATERIAL: '10002',
      DESCRICAO_MATERIAL: 'VALVULA COM NCM DUPLICADO',
      FUP_NCMS: '8481.80.99, 8481.80.99, 7307.29.00',
      FUP_ATO_CONCESSORIO: '00000000000, 20260037354',
      QUANTIDADE_PEDIDA: 20,
      QUANTIDADE_PENDENTE: 20,
      VALOR_LIQUIDO: 9000,
    },
    1
  );

  assert.equal(noNcmRow.FUP_NCMS, '');
  assert.equal(noNcmRow.FUP_ATO_CONCESSORIO, '');
  assert.equal(multiNcmRow.FUP_NCMS, '8481.80.99, 7307.29.00');
  assert.equal(multiNcmRow.FUP_ATO_CONCESSORIO, '20260037354');

  // Clicking "SEM NCM" or "__MISSING__" returns the missing-NCM rows instead of 0 rows
  assert.equal(filterFupItems([noNcmRow, multiNcmRow], { ...BASE_FILTERS, ncm: 'SEM NCM' }).length, 1);
  assert.equal(filterFupItems([noNcmRow, multiNcmRow], { ...BASE_FILTERS, ncm: '__MISSING__' }).length, 1);
  assert.equal(filterFupItems([noNcmRow, multiNcmRow], { ...BASE_FILTERS, ncm: '8481.80.99' }).length, 1);

  const kpis = computeExecutiveKpis([noNcmRow, multiNcmRow], []);
  const semNcmSummary = kpis.ncmSummary.find((n) => n.ncm === 'SEM NCM');
  assert.ok(semNcmSummary);
  assert.equal(semNcmSummary.openQty, 0);
});

test('extractAvailableYears, resolveItemFilterDate, and filterFupItems filter POs and Shipments by year, month, and date basis', () => {
  assert.deepEqual(extractAvailableYears(INITIAL_MFX_SEED_DATA, 'OPS'), ['2026', '2025']);
  assert.deepEqual(extractAvailableYears(INITIAL_MFX_SEED_DATA, 'PO'), ['2026', '2025']);

  // Row 2 (MFX-00003/25): PO in 2025-11, shipped ETD 2026-01
  const row2 = INITIAL_MFX_SEED_DATA[1];
  assert.equal(resolveItemFilterDate(row2, 'OPS'), '2026-01-18');
  assert.equal(resolveItemFilterDate(row2, 'PO'), '2025-11-20');
  assert.equal(resolveItemFilterDate(row2, 'ETD'), '2026-01-18');
  assert.equal(resolveItemFilterDate(row2, 'ETA'), '2026-02-07');
  assert.equal(resolveItemFilterDate(row2, 'DI'), '2026-02-10');

  // Filtering by Year=2026 under OPS excludes old 2025 shipment (4500001082) and keeps 6 active 2026 records
  const ops2026 = filterFupItems(INITIAL_MFX_SEED_DATA, {
    ...BASE_FILTERS,
    year: '2026',
    dateField: 'OPS',
  });
  assert.equal(ops2026.length, 6);
  assert.equal(buildShipmentProcesses(ops2026, {}).length, 4);

  // Filtering by Year=2026 & Month=03 under OPS returns March 2026 shipments + March 2026 open POs
  const ops2026Mar = filterFupItems(INITIAL_MFX_SEED_DATA, {
    ...BASE_FILTERS,
    year: '2026',
    month: '03',
    dateField: 'OPS',
  });
  assert.equal(ops2026Mar.length, 4);

  // Filtering by Year=2026 & Month=10 under OPS narrows to MFX-00018/25
  const ops2026Oct = filterFupItems(INITIAL_MFX_SEED_DATA, {
    ...BASE_FILTERS,
    year: '2026',
    month: '10',
    dateField: 'OPS',
  });
  assert.equal(ops2026Oct.length, 1);
  assert.equal(ops2026Oct[0].ULTIMO_PROCESSO_IMPORTACAO, 'MFX-00018/25');

  // Filtering strictly by PO Date for 2025 matches 2025 POs (4500001082 & 4500001105)
  const po2025 = filterFupItems(INITIAL_MFX_SEED_DATA, {
    ...BASE_FILTERS,
    year: '2025',
    dateField: 'PO',
  });
  assert.equal(po2025.length, 2);

  // Month-only filter (All Years + Oct) matches both Oct 2025 and Oct 2026 under OPS
  const opsOctAllYears = filterFupItems(INITIAL_MFX_SEED_DATA, {
    ...BASE_FILTERS,
    year: '',
    month: '10',
    dateField: 'OPS',
  });
  assert.equal(opsOctAllYears.length, 2);
});

test('buildMaterialAnalytics computes PQR/ABC classes, Most Bought/Used/Expensive highlights, and Kraljic Matrix quadrants', () => {
  const active = filterFupItems(INITIAL_MFX_SEED_DATA, BASE_FILTERS);
  const analytics = buildMaterialAnalytics(active);

  assert.equal(analytics.totalSkus, 7);
  assert.ok(analytics.totalSpendBrl > 2000000);
  assert.ok(analytics.mostBought);
  assert.ok(analytics.mostUsed);
  assert.ok(analytics.mostExpensive);
  assert.equal(analytics.mostBought.materialCode, '20008812'); // 2,400 KG aramid yarn
  assert.equal(analytics.mostUsed.materialCode, '30002890'); // 800 M received / Plant 0003
  assert.equal(analytics.mostExpensive.materialCode, '30004100'); // R$ 547.200 Inconel pipe

  // Every material has P/Q/R, A/B/C, and one of the 4 Kraljic quadrants
  assert.ok(analytics.materials.every((m) => ['P', 'Q', 'R'].includes(m.pqrClass)));
  assert.ok(analytics.materials.every((m) => ['A', 'B', 'C'].includes(m.abcClass)));
  assert.ok(analytics.quadrantSummary.STRATEGIC.count >= 1);
  assert.ok(analytics.quadrantSummary.LEVERAGE.count >= 1);
  assert.ok(analytics.quadrantSummary.NON_CRITICAL.count >= 1);

  // Manual Kraljic override reclassifies the item cleanly
  const overridden = buildMaterialAnalytics(active, {
    '30004100': { quadrant: 'LEVERAGE', note: 'Dual-source contract signed' },
  });
  const inconel = overridden.materials.find((m) => m.materialCode === '30004100');
  assert.ok(inconel);
  assert.equal(inconel.kraljicQuadrant, 'LEVERAGE');
  assert.equal(inconel.computedQuadrant, 'STRATEGIC');
  assert.equal(inconel.overrideNote, 'Dual-source contract signed');

  // Empty input produces clean zeroed analytics
  const empty = buildMaterialAnalytics([]);
  assert.equal(empty.totalSkus, 0);
  assert.equal(empty.mostBought, null);
});

test('detectSimilarMaterials clusters same/similar items with different SAP codes and tracks spec diffs & decisions', () => {
  const rows = [
    // Exact duplicate PT description with different SAP material codes & unit price difference
    normalizeFupRow(
      {
        PEDIDO: '4500009001',
        ITEM_PEDIDO: '10',
        MATERIAL: '000000000030009001',
        DESCRICAO_MATERIAL: 'VALVULA ESFERA ACO INOX 316L 1/2 POL',
        DESCRICAO_MATERIAL_INGLES: 'BALL VALVE STAINLESS STEEL 316L 1/2 INCH',
        FUP_NCMS: '84818099',
        UNIDADE: 'UND',
        MOEDA: 'USD',
        PRECO_UNITARIO: 100,
        VALOR_LIQUIDO: 1000,
        QUANTIDADE_PEDIDA: 10,
        NOME_FORNECEDOR: 'WALTHER PRAZISION',
      },
      0
    ),
    normalizeFupRow(
      {
        PEDIDO: '4500009002',
        ITEM_PEDIDO: '10',
        MATERIAL: '000000000030009002',
        DESCRICAO_MATERIAL: 'VÁLVULA DE ESFERA INOXIDAVEL 316L 1/2"',
        DESCRICAO_MATERIAL_INGLES: 'BALL VALVE SS 316L 1/2 IN',
        FUP_NCMS: '84818099',
        UNIDADE: 'UND',
        MOEDA: 'USD',
        PRECO_UNITARIO: 150,
        VALOR_LIQUIDO: 1500,
        QUANTIDADE_PEDIDA: 10,
        NOME_FORNECEDOR: 'WALTHER PRAZISION',
      },
      1
    ),
    // Third code with identical PT text -> joins the same 3-code cluster transitively
    normalizeFupRow(
      {
        PEDIDO: '4500009003',
        ITEM_PEDIDO: '10',
        MATERIAL: '000000000030009003',
        DESCRICAO_MATERIAL: 'VALVULA ESFERA ACO INOX 316L 1/2 POL',
        DESCRICAO_MATERIAL_INGLES: 'BALL VALVE 316L 1/2 INCH',
        FUP_NCMS: '84818099',
        UNIDADE: 'UND',
        MOEDA: 'USD',
        PRECO_UNITARIO: 120,
        VALOR_LIQUIDO: 1200,
        QUANTIDADE_PEDIDA: 10,
        NOME_FORNECEDOR: 'PARKER HANNIFIN CORP',
      },
      2
    ),
    // Different rating variant (10K PSI vs 15K PSI) -> flags spec difference
    normalizeFupRow(
      {
        PEDIDO: '4500009004',
        ITEM_PEDIDO: '10',
        MATERIAL: '000000000030009100',
        DESCRICAO_MATERIAL: 'MANGUEIRA TERMOPLASTICA ALTA PRESSAO 10K PSI',
        FUP_NCMS: '39173290',
        UNIDADE: 'M',
        MOEDA: 'USD',
        PRECO_UNITARIO: 20,
        VALOR_LIQUIDO: 2000,
        QUANTIDADE_PEDIDA: 100,
      },
      3
    ),
    normalizeFupRow(
      {
        PEDIDO: '4500009005',
        ITEM_PEDIDO: '10',
        MATERIAL: '000000000030009101',
        DESCRICAO_MATERIAL: 'MANGUEIRA TERMOPLASTICA ALTA PRESSAO 15K PSI',
        FUP_NCMS: '39173290',
        UNIDADE: 'M',
        MOEDA: 'USD',
        PRECO_UNITARIO: 25,
        VALOR_LIQUIDO: 2500,
        QUANTIDADE_PEDIDA: 100,
      },
      4
    ),
    // Completely unrelated item
    normalizeFupRow(
      {
        PEDIDO: '4500009006',
        ITEM_PEDIDO: '10',
        MATERIAL: '000000000010009999',
        DESCRICAO_MATERIAL: 'TRANFORMADOR TRIFASICO ALTA TENSAO 13.8KV',
        FUP_NCMS: '85042200',
        UNIDADE: 'UND',
        MOEDA: 'USD',
        PRECO_UNITARIO: 5000,
        VALOR_LIQUIDO: 5000,
        QUANTIDADE_PEDIDA: 1,
      },
      5
    ),
  ];

  const analytics = buildMaterialAnalytics(rows);
  const res = detectSimilarMaterials(analytics.materials, {}, 55);

  assert.equal(res.totalGroups, 2);
  assert.equal(res.totalMaterialsInvolved, 5);
  assert.equal(res.exactDuplicateGroups, 1);

  const valveCluster = res.groups.find((g) => g.materials.some((m) => m.materialCode === '30009001'));
  assert.ok(valveCluster);
  assert.equal(valveCluster.materials.length, 3);
  assert.equal(valveCluster.tier, 'EXACT_DUPLICATE');
  assert.equal(valveCluster.maxSimilarity, 100);
  assert.equal(valveCluster.unitPriceSpreadPct, 50); // 100 vs 150 USD -> +50% spread

  const hoseCluster = res.groups.find((g) => g.materials.some((m) => m.materialCode === '30009100'));
  assert.ok(hoseCluster);
  assert.equal(hoseCluster.materials.length, 2);
  assert.ok(hoseCluster.specDifferences.some((d) => d.includes('10k') && d.includes('15k')));

  // Audit decision persistence
  const withDecision = detectSimilarMaterials(
    analytics.materials,
    {
      [valveCluster.groupId]: {
        status: 'CONFIRMED_DUPLICATE',
        primaryMaterialCode: '30009001',
        note: 'Block 30009002 and 30009003 in SAP MM02',
      },
    },
    55
  );
  assert.equal(withDecision.confirmedDuplicateGroups, 1);
  assert.equal(withDecision.pendingGroups, 1);
  const updatedValve = withDecision.groups.find((g) => g.groupId === valveCluster.groupId);
  assert.equal(updatedValve?.auditStatus, 'CONFIRMED_DUPLICATE');
  assert.equal(updatedValve?.primaryMaterialCode, '30009001');
});

test('calculateBrazilianImportTaxes and buildNumerarioAnalysis follow uploaded SAP values without guessing taxes and support manual simulation', () => {
  const tax = calculateBrazilianImportTaxes({
    valorAduaneiroBrl: 100000,
    iiRatePct: 12,
    ipiRatePct: 5,
    pisRatePct: 2.1,
    cofinsRatePct: 9.65,
    icmsRatePct: 18,
    siscomexBrl: 185,
  });
  assert.equal(tax.iiBrl, 12000);
  assert.equal(tax.ipiBrl, 5600); // 5% of (100000 + 12000)
  assert.equal(tax.pisBrl, 2100);
  assert.equal(tax.cofinsBrl, 9650);
  // ICMS gross-up: (100000+12000+5600+2100+9650+185) / 0.82 * 0.18
  assert.equal(tax.icmsBrl, 28434.51);

  const active = filterFupItems(INITIAL_MFX_SEED_DATA, BASE_FILTERS);
  const processes = buildShipmentProcesses(active, {});
  const res = buildNumerarioAnalysis(active, processes, {}, true);

  assert.equal(res.counts.shipmentRows, 5);
  assert.equal(res.counts.openPoRows, 2);
  assert.equal(res.counts.totalRows, 7);

  // MFX-00037/26 has recorded SAP DI taxes
  const mfx37 = res.rows.find((r) => r.id === 'MFX-00037/26');
  assert.ok(mfx37);
  assert.equal(mfx37.sourceType, 'SAP_DI');
  assert.equal(mfx37.iiBrl, 62808);
  assert.equal(mfx37.ipiBrl, 27844);
  assert.equal(mfx37.pisBrl, 10991);
  assert.equal(mfx37.cofinsBrl, 50508);
  assert.equal(mfx37.icmsBrl, 118420);
  assert.equal(mfx37.siscomexBrl, 185);
  assert.equal(mfx37.totalTaxesBrl, 270756);
  // Clearance fees use exact SAP Armazenagem + Capatazia (no guessed trucking/broker fees)
  assert.equal(mfx37.totalClearanceExpensesBrl, 6460);

  // MFX-00002/25 has Drawback Suspensão -> II/IPI/PIS/COFINS/ICMS = 0, Siscomex = 185 from SAP
  const mfx02 = res.rows.find((r) => r.id === 'MFX-00002/25');
  assert.ok(mfx02);
  assert.equal(mfx02.taxRegime, 'DRAWBACK_SUSP');
  assert.equal(mfx02.sourceType, 'DRAWBACK_SUSPENDED');
  assert.equal(mfx02.iiBrl, 0);
  assert.equal(mfx02.siscomexBrl, 185);
  assert.equal(mfx02.potentialDrawbackSavingsBrl, 0);

  // MFX-00042/26 is Pre-DI Aguardando AC with 0 taxes in Excel -> follows 0 without guessing
  const mfx42 = res.rows.find((r) => r.id === 'MFX-00042/26');
  assert.ok(mfx42);
  assert.equal(mfx42.taxRegime, 'AGUARDANDO_AC');
  assert.equal(mfx42.sourceType, 'SAP_DI');
  assert.equal(mfx42.iiBrl, 0);
  assert.equal(mfx42.ipiBrl, 0);
  assert.equal(mfx42.pisBrl, 0);
  assert.equal(mfx42.cofinsBrl, 0);
  assert.equal(mfx42.icmsBrl, 0);
  assert.equal(mfx42.siscomexBrl, 0);
  assert.equal(mfx42.totalTaxesBrl, 0);
  assert.equal(mfx42.totalClearanceExpensesBrl, 12290); // 11800 armazenagem + 490 capatazia

  // Open POs strictly follow Excel values (0 taxes, 0 guessed freight/insurance/broker)
  const openPo = res.rows.find((r) => r.kind === 'OPEN_PO');
  assert.ok(openPo);
  assert.equal(openPo.sourceType, 'PRE_DI_SAP');
  assert.equal(openPo.totalTaxesBrl, 0);
  assert.equal(openPo.totalClearanceExpensesBrl, 0);

  // Explicit manual rate simulation computes simulated taxes & persists finance approvals
  const simulated = buildNumerarioAnalysis(
    active,
    processes,
    {
      'MFX-00042/26': {
        regimeOverride: 'RECOLHIMENTO_INTEGRAL',
        iiRatePct: 12.6,
        ipiRatePct: 5,
        pisRatePct: 2.1,
        cofinsRatePct: 9.65,
        icmsRatePct: 18,
        siscomexBrl: 185,
        financeStatus: 'APPROVED',
        financeNote: 'What-if full tax simulation',
      },
    },
    false
  );
  const sim42 = simulated.rows.find((r) => r.id === 'MFX-00042/26');
  assert.ok(sim42);
  assert.equal(sim42.sourceType, 'SIMULATED');
  assert.ok(sim42.totalTaxesBrl > 150000);
  assert.equal(sim42.financeStatus, 'APPROVED');
  assert.equal(sim42.financeNote, 'What-if full tax simulation');
});

test('Uploaded FUP Excel with explicit 0 taxes (e.g. MFX-00157/26) never triggers guessed II/PIS/COFINS/ICMS', () => {
  const row194 = normalizeFupRow(
    {
      PEDIDO: '6000000128',
      ITEM_PEDIDO: '00010',
      NOME_FORNECEDOR: 'ARROW SWITZERLAND AG',
      DESCRICAO_MATERIAL: 'FIO ARAMIDA 5402.11.00',
      FUP_NCMS: '5402.11.00',
      MOEDA: 'USD',
      VALOR_LIQUIDO: 1413.0,
      QUANTIDADE_PEDIDA: 97,
      QUANTIDADE_PENDENTE: 97,
      ULTIMO_PROCESSO_IMPORTACAO: 'MFX-00157/26',
      FUP_QUANTIDADE_DI: 97,
      FUP_VALOR_ADUANEIRO: 12860.3472,
      FUP_VALOR_MERCADORIA: 12854.2572,
      FUP_TOTAL_II_ITEM: 0,
      FUP_TOTAL_IPI_ITEM: 0,
      FUP_TOTAL_PIS_ITEM: 0,
      FUP_TOTAL_COFINS_ITEM: 0,
      FUP_TOTAL_ICMS_ITEM: 0,
      FUP_TOTAL_SISCOMEX_ITEM: 5.26,
      FUP_ARMAZENAGEM_PROCESSO: 15800.0,
      FUP_CAPATAZIA_PROCESSO: 768.19,
      FUP_AFRMM_PROCESSO: 0,
      // Even if JSON fallback contains stale non-zero values, explicit flat 0 must win
      DETALHES_FISCAIS_JSON: JSON.stringify([{ NCM: '5402.11.00', II: 999, IPI: 888 }]),
    },
    0
  );

  const row204 = normalizeFupRow(
    {
      PEDIDO: '6000000128',
      ITEM_PEDIDO: '00020',
      NOME_FORNECEDOR: 'ARROW SWITZERLAND AG',
      DESCRICAO_MATERIAL: 'FIO ARAMIDA ALTA TENACIDADE',
      FUP_NCMS: '5402.11.00',
      MOEDA: 'USD',
      VALOR_LIQUIDO: 192801.24,
      QUANTIDADE_PEDIDA: 13236.4,
      QUANTIDADE_PENDENTE: 13236.4,
      ULTIMO_PROCESSO_IMPORTACAO: 'MFX-00157/26',
      FUP_QUANTIDADE_DI: 13236.4,
      FUP_VALOR_ADUANEIRO: 1754893.812,
      FUP_VALOR_MERCADORIA: 1754062.79,
      FUP_TOTAL_II_ITEM: 0,
      FUP_TOTAL_IPI_ITEM: 0,
      FUP_TOTAL_PIS_ITEM: 0,
      FUP_TOTAL_COFINS_ITEM: 0,
      FUP_TOTAL_ICMS_ITEM: 0,
      FUP_TOTAL_SISCOMEX_ITEM: 717.65,
      FUP_ARMAZENAGEM_PROCESSO: 15800.0,
      FUP_CAPATAZIA_PROCESSO: 768.19,
      FUP_AFRMM_PROCESSO: 0,
    },
    1
  );

  assert.equal(row194.FUP_TOTAL_II_ITEM, 0);
  assert.equal(row194.FUP_TOTAL_IPI_ITEM, 0);
  assert.equal(row194.hasExplicitSapTaxes, true);

  const processes = buildShipmentProcesses([row194, row204], {});
  const analysis = buildNumerarioAnalysis([row194, row204], processes, {}, true);
  const mfx157 = analysis.rows.find((r) => r.id === 'MFX-00157/26');

  assert.ok(mfx157);
  assert.equal(mfx157.sourceType, 'SAP_DI');
  assert.equal(mfx157.valorAduaneiroBrl, 1767754.16);
  assert.equal(mfx157.iiBrl, 0);
  assert.equal(mfx157.ipiBrl, 0);
  assert.equal(mfx157.pisBrl, 0);
  assert.equal(mfx157.cofinsBrl, 0);
  assert.equal(mfx157.icmsBrl, 0);
  assert.equal(mfx157.iiRatePct, 0);
  assert.equal(mfx157.pisRatePct, 0);
  assert.equal(mfx157.cofinsRatePct, 0);
  assert.equal(mfx157.icmsRatePct, 0);
  assert.equal(mfx157.siscomexBrl, 722.91);
  assert.equal(mfx157.afrmmBrl, 0);
  assert.equal(mfx157.totalTaxesBrl, 722.91);
  assert.equal(mfx157.totalClearanceExpensesBrl, 16568.19);
  assert.equal(mfx157.totalNumerarioBrl, 17291.1);
});

test('buildShipmentWorthinessAnalysis evaluates order cost ratios, Air vs Sea ROI, and cross-order SKU troubles without guessing taxes', () => {
  const active = filterFupItems(INITIAL_MFX_SEED_DATA, BASE_FILTERS);
  const processes = buildShipmentProcesses(active, {});
  const worth = buildShipmentWorthinessAnalysis(processes, active, INITIAL_MFX_SEED_DATA);

  assert.equal(worth.rows.length, 5);
  assert.ok(worth.summary.totalFobBrl > 0);
  assert.ok(worth.summary.airShipmentCount >= 2);

  // MFX-00042/26 (Air, missing AC on 84818099, delayed +22d, stalled PARADO AG. DRAWBACK) -> AVOIDABLE_AIR & NOT_WORTH_IT
  const mfx42 = worth.rows.find((r) => r.ref === 'MFX-00042/26');
  assert.ok(mfx42);
  assert.equal(mfx42.airEvaluation.isAir, true);
  assert.equal(mfx42.airEvaluation.verdict, 'AVOIDABLE_AIR');
  assert.equal(mfx42.worthinessVerdict, 'NOT_WORTH_IT');
  assert.equal(mfx42.customsTaxesBrl, 0); // Strictly preserves SAP 0 taxes
  assert.ok(mfx42.recommendations.some((rec) => rec.code === 'LINK_DRAWBACK_AC'));
  assert.ok(mfx42.recommendations.some((rec) => rec.code === 'SHIFT_AIR_TO_SEA'));

  // MFX-00037/26 (SIEMENS Air EXW, 5.4% freight/FOB, 3d transit, on-time green channel) -> JUSTIFIED_AIR + REVIEW (statutory tax burden) + EXW advice
  const mfx37 = worth.rows.find((r) => r.ref === 'MFX-00037/26');
  assert.ok(mfx37);
  assert.equal(mfx37.airEvaluation.isAir, true);
  assert.equal(mfx37.airEvaluation.verdict, 'JUSTIFIED_AIR');
  assert.equal(mfx37.worthinessVerdict, 'REVIEW');
  assert.ok(mfx37.recommendations.some((rec) => rec.code === 'INCOTERM_EXW_TO_FCA'));

  // Cross-order recurring SKU trouble check even when filtered to a single recent shipment
  const histPo1 = normalizeFupRow(
    {
      PEDIDO: '4500008001',
      ITEM_PEDIDO: '10',
      DATA_PEDIDO: '2025-05-10',
      NOME_FORNECEDOR: 'CHRONO PARTS GMBH',
      MATERIAL: '000000000099001122',
      DESCRICAO_MATERIAL: 'VALVULA SUBMARINA RECORRENTE',
      FUP_NCMS: '84818099',
      MOEDA: 'USD',
      VALOR_LIQUIDO: 20000,
      QUANTIDADE_PEDIDA: 10,
      DIAS_ATRASO_ENTREGA: 18,
      STATUS_PRAZO_ENTREGA: 'ATRASADO',
      FUP_TIPO_EMBARQUE: 'A',
      FUP_INCOTERM: 'EXW',
      ULTIMO_PROCESSO_IMPORTACAO: 'MFX-00001/25',
      FUP_VALOR_MERCADORIA: 113000,
      FUP_TOTAL_FRETE_FISCAL_ITEM: 18000,
    },
    0
  );
  const currentPo2 = normalizeFupRow(
    {
      PEDIDO: '4500008099',
      ITEM_PEDIDO: '10',
      DATA_PEDIDO: '2026-06-10',
      NOME_FORNECEDOR: 'CHRONO PARTS GMBH',
      MATERIAL: '000000000099001122',
      DESCRICAO_MATERIAL: 'VALVULA SUBMARINA RECORRENTE',
      FUP_NCMS: '84818099',
      MOEDA: 'USD',
      VALOR_LIQUIDO: 25000,
      QUANTIDADE_PEDIDA: 10,
      DIAS_ATRASO_ENTREGA: 12,
      STATUS_PRAZO_ENTREGA: 'ATRASADO',
      FUP_TIPO_EMBARQUE: 'A',
      FUP_INCOTERM: 'EXW',
      ULTIMO_PROCESSO_IMPORTACAO: 'MFX-00099/26',
      ETD: '2026-06-20',
      ETA: '2026-06-24',
      FUP_VALOR_MERCADORIA: 141250,
      FUP_TOTAL_FRETE_FISCAL_ITEM: 22000,
      FUP_TOTAL_II_ITEM: 0,
      FUP_TOTAL_IPI_ITEM: 0,
      FUP_TOTAL_PIS_ITEM: 0,
      FUP_TOTAL_COFINS_ITEM: 0,
      FUP_TOTAL_ICMS_ITEM: 0,
    },
    1
  );

  const filteredProcs = buildShipmentProcesses([currentPo2], {});
  const crossWorth = buildShipmentWorthinessAnalysis(
    filteredProcs,
    [currentPo2],
    [histPo1, currentPo2]
  );

  assert.equal(crossWorth.rows.length, 1);
  const row99 = crossWorth.rows[0];
  assert.equal(row99.customsTaxesBrl, 0);
  assert.equal(row99.itemTroubleSummary.hasRecurringTrouble, true);
  assert.equal(row99.itemTroubleSummary.lateOrderCount, 2);
  assert.equal(row99.itemTroubleSummary.repeatAirCount, 2);
  assert.equal(row99.airEvaluation.verdict, 'AVOIDABLE_AIR');
  assert.equal(row99.worthinessVerdict, 'NOT_WORTH_IT');
  assert.ok(crossWorth.materialTroubles[0].severity === 'HIGH');
  assert.ok(crossWorth.materialTroubles[0].troubleSignals.some((s) => s.includes('Repeat delays')));
});

test('buildOrderStatusMatrixAoa places PEP column directly after Estoque without duplicate PROJETO rows and includes PO #, BL / AWB, and NF (DOCNUM) metadata rows', () => {
  const active = filterFupItems(INITIAL_MFX_SEED_DATA, BASE_FILTERS);
  const matrix = buildOrderStatusMatrix(active, {});
  const aoa = buildOrderStatusMatrixAoa(matrix, {});

  // Top 9 metadata rows: Cols A-G blank, Col H (index 7) has label
  assert.equal(aoa[0][7], 'N#');
  assert.equal(aoa[1][7], 'PO #');
  assert.equal(aoa[2][7], 'BL / AWB');
  assert.equal(aoa[3][7], 'NF (DOCNUM)');
  assert.equal(aoa[4][7], 'Supplier');
  assert.equal(aoa[8][7], 'ETA');

  // Row 10 header: Estoque at index 5 (F), PEP at index 6 (G), TIPO at index 7 (H)
  const headerRow = aoa[9];
  assert.equal(headerRow[5], 'Estoque');
  assert.equal(headerRow[6], 'PEP');
  assert.equal(headerRow[7], 'TIPO');

  // First material row is directly at aoa[10] (no duplicate PROJETO separator rows)
  const firstMaterialRow = aoa[10];
  assert.ok(!String(firstMaterialRow[0]).startsWith('PROJETO:'));
  assert.ok(String(firstMaterialRow[6]).length > 0);
});

test('buildOrderStatusMatrix populates poNumbers, blAwb, and nfDocnum (from Col AQ PROCESSOS_JSON) for BL columns and separates/orders columns by ETA date when separateByEtaDate is true', () => {
  const active = filterFupItems(INITIAL_MFX_SEED_DATA, BASE_FILTERS);
  const defaultMatrix = buildOrderStatusMatrix(active, {}, false);
  const blCols = defaultMatrix.columns.filter((c) => c.kind === 'BL');
  assert.ok(blCols.length > 0);
  for (const col of blCols) {
    assert.ok(col.poNumbers.length > 0 && col.poNumbers !== '-');
    assert.ok(col.blAwb.length > 0 && col.blAwb !== '-');
  }
  const mfx02Col = blCols.find((c) => c.number === 'MFX-00002/25');
  assert.equal(mfx02Col?.nfDocnum, '0000048192');
  const mfx03Col = blCols.find((c) => c.number === 'MFX-00003/25');
  assert.equal(mfx03Col?.nfDocnum, '-'); // DOCNUM '0000000000' in PROCESSOS_JSON is treated as not issued

  // Test separateByEtaDate = true sorts chronologically and splits multi-ETA POs + extracts DOCNUM from Col AQ PROCESSOS_JSON
  const itemEarly = normalizeFupRow(
    {
      PEDIDO: '4500999001',
      ITEM_PEDIDO: '10',
      MATERIAL: '10099901',
      DESCRICAO_MATERIAL: 'CABO TESTE A',
      QUANTIDADE_PEDIDA: 100,
      QUANTIDADE_ENTREGUE: 0,
      DATA_ENTREGA_PREVISTA: '2026-10-15',
    },
    0
  );
  const itemLateSamePo = normalizeFupRow(
    {
      PEDIDO: '4500999001',
      ITEM_PEDIDO: '20',
      MATERIAL: '10099902',
      DESCRICAO_MATERIAL: 'CABO TESTE B',
      QUANTIDADE_PEDIDA: 50,
      QUANTIDADE_ENTREGUE: 0,
      DATA_ENTREGA_PREVISTA: '2026-12-20',
    },
    1
  );
  const itemMidBl = normalizeFupRow(
    {
      PEDIDO: '4500999002',
      ITEM_PEDIDO: '10',
      MATERIAL: '10099901',
      DESCRICAO_MATERIAL: 'CABO TESTE A',
      ULTIMO_PROCESSO_IMPORTACAO: 'MFX-00043/26',
      CONHECIMENTO_EMBARQUE: '05758486993',
      QUANTIDADE_PEDIDA: 80,
      QUANTIDADE_ENTREGUE: 80,
      FUP_QUANTIDADE_PROCESSO: 80,
      ETD: '2026-10-20',
      ETA: '2026-11-05',
      PROCESSOS_JSON: JSON.stringify([
        {
          MANDT: '400',
          NUM_PROCESSO: 'MFX-00043/26',
          CONHECIMENTO_EMBARQUE: '05758486993',
          NUM_DI: '26/0246304-2',
          DT_DI: '20260210',
          DOCNUM: '0000039644',
          NFENUM: '',
          SERIES: '005',
          NF_CRIADO_POR: 'OALONSO',
          NF_DATA_CRIACAO: '20260213',
        },
      ]),
    },
    2
  );

  const byPoMatrix = buildOrderStatusMatrix([itemEarly, itemLateSamePo, itemMidBl], {}, false);
  // When not separated by ETA, PO 4500999001 is 1 column + MFX-00043/26 is 1 column = 2 columns
  assert.equal(byPoMatrix.columns.length, 2);

  const byEtaMatrix = buildOrderStatusMatrix([itemEarly, itemLateSamePo, itemMidBl], {}, true);
  // When separated by ETA date, PO 4500999001 splits into 2 ETA columns + MFX-00043/26 = 3 columns sorted chronologically
  assert.equal(byEtaMatrix.columns.length, 3);
  assert.deepEqual(
    byEtaMatrix.columns.map((c) => c.etaIso),
    ['2026-10-15', '2026-11-05', '2026-12-20']
  );
  assert.equal(byEtaMatrix.columns[1].kind, 'BL');
  assert.equal(byEtaMatrix.columns[1].poNumbers, '4500999002');
  assert.equal(byEtaMatrix.columns[1].blAwb, '05758486993');
  assert.equal(byEtaMatrix.columns[1].nfDocnum, '0000039644');
});




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
  buildOrderStatusMatrix,
  buildPartnerScorecards,
  buildShipmentProcesses,
  computeDirectorChartMetrics,
  computeExecutiveKpis,
  extractAvailableYears,
  filterFupItems,
  parseContainerCounts,
  resolveItemFilterDate,
} from './comexEngine';
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





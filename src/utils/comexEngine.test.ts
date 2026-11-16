import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAtoConcessorio,
  normalizeFupRow,
  parseExcelDate,
  stripLeadingZeros,
} from './sapParser';
import {
  buildCashFlowData,
  buildOrderStatusMatrix,
  buildPartnerScorecards,
  buildShipmentProcesses,
  computeExecutiveKpis,
  filterFupItems,
} from './comexEngine';
import { INITIAL_MFX_SEED_DATA } from '../data/mfxSeedData';

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
  const baseFilters = {
    search: '',
    pep: '',
    atoConcessorio: '',
    supplier: '',
    ncm: '',
    buyer: '',
    status: '',
    hideDeleted: true,
  };
  const visibleDefault = filterFupItems(INITIAL_MFX_SEED_DATA, baseFilters);
  assert.equal(visibleDefault.length, 7);
  const visibleAll = filterFupItems(INITIAL_MFX_SEED_DATA, {
    ...baseFilters,
    hideDeleted: false,
  });
  assert.equal(visibleAll.length, 8);
});

test('buildShipmentProcesses aggregates MFX processes and applies operational overrides', () => {
  const active = filterFupItems(INITIAL_MFX_SEED_DATA, {
    search: '',
    pep: '',
    atoConcessorio: '',
    supplier: '',
    ncm: '',
    buyer: '',
    status: '',
    hideDeleted: true,
  });
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
  const active = filterFupItems(INITIAL_MFX_SEED_DATA, {
    search: '',
    pep: '',
    atoConcessorio: '',
    supplier: '',
    ncm: '',
    buyer: '',
    status: '',
    hideDeleted: true,
  });
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


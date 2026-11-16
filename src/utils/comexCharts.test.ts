import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_MFX_SEED_DATA } from '../data/mfxSeedData';
import {
  buildComexChartsAnalytics,
  buildShipmentProcesses,
  filterFupItems,
} from './comexEngine';
import { normalizeFupRow } from './sapParser';

test('buildComexChartsAnalytics computes all 12 chart domains accurately on MFX baseline data', () => {
  const visibleItems = filterFupItems(INITIAL_MFX_SEED_DATA, {
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
  });

  const processes = buildShipmentProcesses(visibleItems, {});
  const res = buildComexChartsAnalytics(visibleItems, processes);

  // 1. Quantity of Shipments
  assert.equal(res.totals.totalShipments, 5);
  const stageSum = res.shipmentsByStage.reduce((s, st) => s + st.count, 0);
  assert.equal(stageSum, 5);

  // 2. Channels of Customs
  const channelSum = res.customsChannels.reduce((s, ch) => s + ch.count, 0);
  assert.equal(channelSum, 5);
  assert.equal(res.totals.registeredDiCount, 4);

  // 3. Quantity of Containers & TEUs
  assert.equal(res.totals.total20Cntr, 1);
  assert.equal(res.totals.total40Cntr, 2);
  assert.equal(res.totals.totalContainers, 3);
  assert.equal(res.totals.totalTeus, 5);
  assert.equal(res.totals.seaShipments, 3);
  assert.equal(res.totals.airShipments, 2);

  // 4. Costs of Freight
  assert.ok(res.totals.totalFreightBrl > 100000);
  assert.equal(res.freightByProcess.length, 5);

  // 5. Strict SAP Taxes (Drawback processes have 0 II/IPI/PIS/COFINS/ICMS in SAP; only MFX-00037/26 has full tax)
  const mfx02Tax = res.taxByProcess.find((p) => p.processRef === 'MFX-00002/25');
  assert.ok(mfx02Tax);
  assert.equal(mfx02Tax.iiBrl, 0);
  assert.equal(mfx02Tax.ipiBrl, 0);
  assert.equal(mfx02Tax.pisCofinsBrl, 0);
  assert.equal(mfx02Tax.icmsBrl, 0);
  assert.equal(mfx02Tax.siscomexAfrmmBrl, 185);

  const mfx37Tax = res.taxByProcess.find((p) => p.processRef === 'MFX-00037/26');
  assert.ok(mfx37Tax);
  assert.equal(mfx37Tax.iiBrl, 62808);
  assert.equal(mfx37Tax.icmsBrl, 118420);

  // 6. Delays Totalized
  assert.equal(res.totals.totalDelayDays, 14 + 22 + 5);
  assert.equal(res.totals.delayedPoCount, 3);
  assert.equal(res.totals.maxDelayDays, 22);

  // 7. Time of Customs Clearance
  assert.equal(res.totals.clearedProcessCount, 2);
  assert.equal(res.totals.avgClearanceDays, 3);

  // 8. Time of NF Issue
  assert.equal(res.totals.nfIssuedCount, 2);
  assert.ok(res.totals.avgNfTurnaroundDays > 0);
  assert.equal(
    res.nfStatusSummary.reduce((s, n) => s + n.count, 0),
    5
  );

  // 9. Time of Delivery
  assert.ok(res.totals.avgTransitDays > 0);
  assert.ok(res.totals.avgLeadTimeDays > 0);
  assert.equal(res.deliveryByProcess.length, 5);

  // 10. Time of Storage
  assert.ok(res.totals.avgStorageDays > 0);
  assert.ok(res.totals.totalStoragePeriods >= 5);
  assert.ok(res.totals.totalStorageCostBrl > 0);

  // 11. Invoices Values
  assert.ok(res.totals.totalInvoicesBrl > 1500000);
  assert.equal(res.invoicesByProcess.length, 5);
  assert.equal(res.invoicesByFinancialStatus.length, 4);

  // 12. PEP & Team Results
  assert.ok(res.pepProjectsChart.length >= 4);
  assert.ok(res.teamResultsChart.length >= 3);
});

test('buildComexChartsAnalytics never guesses taxes when uploaded SAP tax fields are 0 and handles empty input', () => {
  const zeroTaxRow = normalizeFupRow(
    {
      PEDIDO: '6800009999',
      ITEM_PEDIDO: '00010',
      NOME_FORNECEDOR: 'ARROW SWITZERLAND',
      NOME_COMPRADOR: 'LUCAS MENDES',
      MATERIAL: '30009999',
      DESCRICAO_MATERIAL: 'CABO ESPECIAL',
      FUP_NCMS: '54021100',
      MOEDA: 'USD',
      VALOR_LIQUIDO: 100000,
      QUANTIDADE_PEDIDA: 100,
      QUANTIDADE_PENDENTE: 100,
      ULTIMO_PROCESSO_IMPORTACAO: 'MFX-00157/26',
      FUP_TIPO_EMBARQUE: 'M',
      FUP_VALOR_ADUANEIRO: 570000,
      FUP_VALOR_MERCADORIA: 550000,
      FUP_TOTAL_II_ITEM: 0,
      FUP_TOTAL_IPI_ITEM: 0,
      FUP_TOTAL_PIS_ITEM: 0,
      FUP_TOTAL_COFINS_ITEM: 0,
      FUP_TOTAL_ICMS_ITEM: 0,
      FUP_TOTAL_SISCOMEX_ITEM: 0,
    },
    0
  );

  const procs = buildShipmentProcesses([zeroTaxRow], {});
  const res = buildComexChartsAnalytics([zeroTaxRow], procs);

  assert.equal(res.totals.iiBrl, 0);
  assert.equal(res.totals.ipiBrl, 0);
  assert.equal(res.totals.pisBrl, 0);
  assert.equal(res.totals.cofinsBrl, 0);
  assert.equal(res.totals.icmsBrl, 0);
  assert.equal(res.totals.siscomexBrl, 0);
  assert.equal(res.totals.totalTaxesBrl, 0);

  // Empty state check
  const emptyRes = buildComexChartsAnalytics([], []);
  assert.equal(emptyRes.totals.totalShipments, 0);
  assert.equal(emptyRes.totals.totalDelayDays, 0);
  assert.equal(emptyRes.totals.totalTaxesBrl, 0);
});

import type {
  AbcClass,
  CashFlowEntry,
  ComexChartsAnalyticsResult,
  ComexFilters,
  CostOptimizationAction,
  DateFilterBasis,
  FupItemRow,
  KraljicOverride,
  KraljicQuadrant,
  MaterialAnalyticsResult,
  MaterialProcurementItem,
  MaterialTroubleProfile,
  MatrixColumnMeta,
  MatrixMaterialRow,
  MatrixProjectSection,
  NumerarioAnalysisResult,
  NumerarioCostLine,
  NumerarioFinanceStatus,
  NumerarioOverride,
  NumerarioSourceType,
  NumerarioTaxRegime,
  OrderStatusMatrixData,
  PartnerScorecard,
  PqrClass,
  ProcessDetailJson,
  ShipmentAirEvaluation,
  ShipmentCostBenefitRow,
  ShipmentItemTroubleSummary,
  ShipmentOperationalStatus,
  ShipmentOverrides,
  ShipmentProcessRow,
  ShipmentWorthinessAnalysisResult,
  ShipmentWorthinessVerdict,
  SimilarGroupDecision,
  SimilarItemsAnalysisResult,
  SimilarMaterialGroup,
  SimilarMatchTier,
  SimilarPairEvidence,
  SwotData,
} from '../types/comex';
import { daysBetween, formatDateBr } from './sapParser';

// NCM prefixes typically eligible/linked to Drawback Suspensão in MFX operations
const DRAWBACK_COMMON_NCM_PREFIXES = ['7304', '7306', '3917', '8544', '8481', '7307', '4009', '7411', '7608'];

export function isDrawbackExpectedNcm(ncm: string): boolean {
  const clean = (ncm || '').replace(/\D/g, '');
  return DRAWBACK_COMMON_NCM_PREFIXES.some((p) => clean.startsWith(p));
}

export function resolveItemFilterDate(
  item: FupItemRow,
  basis: DateFilterBasis = 'OPS'
): string {
  switch (basis) {
    case 'PO':
      return item.DATA_PEDIDO || '';
    case 'ETD':
      return item.ETD || '';
    case 'ETA':
      return item.ETA || '';
    case 'DI':
      return item.DATA_DI || '';
    case 'DELIVERY':
      return (
        item.DATA_ENTREGA_MFX ||
        item.ULTIMA_DATA_RECEBIMENTO ||
        item.DATA_ENTREGA_PREVISTA ||
        ''
      );
    case 'OPS':
    default:
      return (
        item.ETD ||
        item.ETA ||
        item.DATA_DI ||
        item.FUP_DATA_PRESENCA_CARGA ||
        item.DATA_DESEMBARACO ||
        item.DATA_ENTREGA_MFX ||
        item.DATA_PEDIDO ||
        item.DATA_ENTREGA_PREVISTA ||
        item.ULTIMA_DATA_RECEBIMENTO ||
        ''
      );
  }
}

export function extractAvailableYears(
  items: FupItemRow[],
  basis: DateFilterBasis = 'OPS'
): string[] {
  const years = new Set<string>();
  for (const item of items) {
    const iso = resolveItemFilterDate(item, basis);
    const match = iso.match(/^(\d{4})-\d{2}-\d{2}/);
    if (match) years.add(match[1]);
  }
  return Array.from(years).sort((a, b) => b.localeCompare(a));
}

export function filterFupItems(items: FupItemRow[], filters: ComexFilters): FupItemRow[] {
  const q = filters.search.trim().toLowerCase();
  const dateBasis: DateFilterBasis = filters.dateField || 'OPS';

  return items.filter((item) => {
    if (filters.hideDeleted) {
      if (item.LOEKZ === 'L' || item.STATUS_PRAZO_ENTREGA === 'ITEM EXCLUIDO' || item.STATUS_ITEM_SAP === 'ITEM EXCLUIDO') {
        return false;
      }
    }
    if (filters.pep && item.DESCRICAO_ELEMENTO_PEP !== filters.pep) return false;
    if (filters.atoConcessorio) {
      if (filters.atoConcessorio === '__MISSING__') {
        if (item.FUP_ATO_CONCESSORIO) return false;
      } else {
        const acTokens = item.FUP_ATO_CONCESSORIO.split(',').map((s) => s.trim());
        if (
          item.FUP_ATO_CONCESSORIO !== filters.atoConcessorio &&
          !acTokens.includes(filters.atoConcessorio)
        ) {
          return false;
        }
      }
    }
    if (filters.supplier && item.NOME_FORNECEDOR !== filters.supplier) return false;
    if (filters.ncm) {
      if (filters.ncm === '__MISSING__' || filters.ncm === 'SEM NCM') {
        if (item.FUP_NCMS) return false;
      } else {
        const ncmTokens = item.FUP_NCMS.split(',').map((s) => s.trim());
        if (item.FUP_NCMS !== filters.ncm && !ncmTokens.includes(filters.ncm)) {
          return false;
        }
      }
    }
    if (filters.buyer && item.NOME_COMPRADOR !== filters.buyer) return false;
    if (filters.status && item.STATUS_PRAZO_ENTREGA !== filters.status) return false;

    if (filters.year || filters.month) {
      const refIso = resolveItemFilterDate(item, dateBasis);
      if (!refIso || refIso.length < 7) return false;
      if (filters.year && refIso.slice(0, 4) !== filters.year) return false;
      if (filters.month && refIso.slice(5, 7) !== filters.month) return false;
    }

    if (q) {
      const haystack = [
        item.PEDIDO,
        item.ULTIMO_PROCESSO_IMPORTACAO,
        item.FUP_NUMEROS_PROCESSOS,
        item.DESCRICAO_ELEMENTO_PEP,
        item.ELEMENTO_PEP_INTERNO,
        item.FUP_ATO_CONCESSORIO,
        item.NOME_FORNECEDOR,
        item.FUP_NCMS,
        item.NOME_COMPRADOR,
        item.MATERIAL,
        item.DESCRICAO_MATERIAL,
        item.DESCRICAO_MATERIAL_INGLES,
        item.NUM_DI,
        item.CONHECIMENTO_EMBARQUE,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export interface ExecutiveKpis {
  activePoCount: number;
  openItemCount: number;
  totalOpenQty: number;
  openValueByCurrency: Record<string, number>;
  onTimeCount: number;
  delayedCount: number;
  completedCount: number;
  onTimeRate: number;
  avgDelayDays: number;
  processCounts: {
    total: number;
    inTransit: number;
    awaitingClearance: number;
    cleared: number;
    delivered: number;
    stoppedDrawback: number;
  };
  drawbackFobBrl: number;
  fullTaxFobBrl: number;
  totalTaxesBrl: number;
  ncmSummary: Array<{
    ncm: string;
    itemCount: number;
    openQty: number;
    totalValueUsdOrOrig: number;
    currency: string;
    hasDrawbackCount: number;
    missingAcAlert: boolean;
    acNumbers: string[];
  }>;
  pepProgress: Array<{
    pepCode: string;
    pepDescription: string;
    totalOrdered: number;
    receivedQty: number;
    inTransitQty: number;
    pendingShipmentQty: number;
    pctReceived: number;
    pctInTransit: number;
    totalValueBrl: number;
  }>;
}

export function computeExecutiveKpis(
  items: FupItemRow[],
  processes: ShipmentProcessRow[]
): ExecutiveKpis {
  const nonDeleted = items.filter(
    (i) => i.LOEKZ !== 'L' && i.STATUS_PRAZO_ENTREGA !== 'ITEM EXCLUIDO'
  );
  const activePos = new Set(nonDeleted.filter((i) => i.QUANTIDADE_PENDENTE > 0).map((i) => i.PEDIDO));
  const openItems = nonDeleted.filter((i) => i.QUANTIDADE_PENDENTE > 0);
  const totalOpenQty = openItems.reduce((sum, i) => sum + i.QUANTIDADE_PENDENTE, 0);

  const openValueByCurrency: Record<string, number> = {};
  for (const item of openItems) {
    const ratio = item.QUANTIDADE_PEDIDA > 0 ? item.QUANTIDADE_PENDENTE / item.QUANTIDADE_PEDIDA : 1;
    const openVal = item.VALOR_LIQUIDO * ratio;
    const curr = item.MOEDA || 'USD';
    openValueByCurrency[curr] = (openValueByCurrency[curr] || 0) + openVal;
  }

  const onTimeCount = nonDeleted.filter((i) => i.STATUS_PRAZO_ENTREGA === 'NO PRAZO').length;
  const delayedItems = nonDeleted.filter((i) => i.STATUS_PRAZO_ENTREGA === 'ATRASADO');
  const delayedCount = delayedItems.length;
  const completedCount = nonDeleted.filter((i) => i.STATUS_PRAZO_ENTREGA === 'ENTREGA CONCLUIDA SAP').length;
  const evaluated = onTimeCount + delayedCount;
  const onTimeRate = evaluated > 0 ? Math.round((onTimeCount / evaluated) * 1000) / 10 : 100;
  const avgDelayDays =
    delayedItems.length > 0
      ? Math.round(
          (delayedItems.reduce((s, i) => s + Math.max(0, i.DIAS_ATRASO_ENTREGA), 0) / delayedItems.length) * 10
        ) / 10
      : 0;

  const processCounts = {
    total: processes.length,
    inTransit: processes.filter((p) => p.status === 'EM TRÂNSITO' || p.status === 'AG. PRONTIDAO DA CARGA').length,
    awaitingClearance: processes.filter((p) => p.status === 'AG. DESEMBARAÇO').length,
    cleared: processes.filter((p) => Boolean(p.desCi) && p.status !== 'ENTREGUE').length,
    delivered: processes.filter((p) => p.status === 'ENTREGUE').length,
    stoppedDrawback: processes.filter((p) => p.status === 'PARADO AG. DRAWBACK').length,
  };

  let drawbackFobBrl = 0;
  let fullTaxFobBrl = 0;
  let totalTaxesBrl = 0;
  for (const item of nonDeleted) {
    const itemRate =
      item.MOEDA === 'BRL'
        ? 1
        : item.MOEDA === 'EUR'
          ? item.FUP_TAXA_EURO_PROCESSO || 6.12
          : item.FUP_TAXA_DOLAR_PROCESSO || 5.65;
    const fobBrl =
      item.FUP_VALOR_MERCADORIA > 0
        ? item.FUP_VALOR_MERCADORIA
        : item.FUP_VALOR_FOB_REAIS_PROCESSO > 0
          ? item.FUP_VALOR_FOB_REAIS_PROCESSO
          : item.VALOR_LIQUIDO * itemRate;
    if (item.FUP_ATO_CONCESSORIO) {
      drawbackFobBrl += fobBrl;
    } else {
      fullTaxFobBrl += fobBrl;
    }
    totalTaxesBrl +=
      item.FUP_TOTAL_II_ITEM +
      item.FUP_TOTAL_IPI_ITEM +
      item.FUP_TOTAL_PIS_ITEM +
      item.FUP_TOTAL_COFINS_ITEM +
      item.FUP_TOTAL_ICMS_ITEM +
      item.FUP_TOTAL_SISCOMEX_ITEM;
  }

  // NCM Summary
  const ncmMap = new Map<
    string,
    {
      itemCount: number;
      openQty: number;
      totalValue: number;
      currency: string;
      hasDrawbackCount: number;
      missingAcAlert: boolean;
      acNumbers: Set<string>;
    }
  >();

  for (const item of nonDeleted) {
    const ncm = item.FUP_NCMS || 'SEM NCM';
    const curr = ncmMap.get(ncm) || {
      itemCount: 0,
      openQty: 0,
      totalValue: 0,
      currency: item.MOEDA || 'USD',
      hasDrawbackCount: 0,
      missingAcAlert: false,
      acNumbers: new Set<string>(),
    };
    curr.itemCount += 1;
    curr.openQty += Math.max(0, item.QUANTIDADE_PENDENTE);
    curr.totalValue += item.VALOR_LIQUIDO;
    if (item.FUP_ATO_CONCESSORIO) {
      curr.hasDrawbackCount += 1;
      for (const acToken of item.FUP_ATO_CONCESSORIO.split(',')) {
        const cleanAc = acToken.trim();
        if (cleanAc) curr.acNumbers.add(cleanAc);
      }
    } else if (isDrawbackExpectedNcm(ncm)) {
      curr.missingAcAlert = true;
    }
    ncmMap.set(ncm, curr);
  }

  const ncmSummary = Array.from(ncmMap.entries())
    .map(([ncm, data]) => ({
      ncm,
      itemCount: data.itemCount,
      openQty: data.openQty,
      totalValueUsdOrOrig: data.totalValue,
      currency: data.currency,
      hasDrawbackCount: data.hasDrawbackCount,
      missingAcAlert: data.missingAcAlert,
      acNumbers: Array.from(data.acNumbers),
    }))
    .sort((a, b) => b.totalValueUsdOrOrig - a.totalValueUsdOrOrig);

  // PEP Progress
  const pepMap = new Map<
    string,
    {
      pepCode: string;
      pepDescription: string;
      totalOrdered: number;
      receivedQty: number;
      inTransitQty: number;
      pendingShipmentQty: number;
      totalValueBrl: number;
    }
  >();

  for (const item of nonDeleted) {
    const key = item.DESCRICAO_ELEMENTO_PEP || item.ELEMENTO_PEP_INTERNO || 'SEM PROJETO PEP';
    const entry = pepMap.get(key) || {
      pepCode: item.ELEMENTO_PEP_INTERNO || '-',
      pepDescription: key,
      totalOrdered: 0,
      receivedQty: 0,
      inTransitQty: 0,
      pendingShipmentQty: 0,
      totalValueBrl: 0,
    };
    entry.totalOrdered += item.QUANTIDADE_PEDIDA;
    entry.receivedQty += item.QUANTIDADE_RECEBIDA_LIQUIDA;
    const isInTransit = Boolean(item.ULTIMO_PROCESSO_IMPORTACAO) && item.QUANTIDADE_PENDENTE > 0;
    if (isInTransit) {
      entry.inTransitQty += item.QUANTIDADE_PENDENTE;
    } else {
      entry.pendingShipmentQty += item.QUANTIDADE_PENDENTE;
    }
    const itemRate =
      item.MOEDA === 'BRL'
        ? 1
        : item.MOEDA === 'EUR'
          ? item.FUP_TAXA_EURO_PROCESSO || 6.12
          : item.FUP_TAXA_DOLAR_PROCESSO || 5.65;
    entry.totalValueBrl +=
      item.FUP_VALOR_MERCADORIA > 0
        ? item.FUP_VALOR_MERCADORIA
        : item.FUP_VALOR_FOB_REAIS_PROCESSO > 0
          ? item.FUP_VALOR_FOB_REAIS_PROCESSO
          : item.VALOR_LIQUIDO * itemRate;

    pepMap.set(key, entry);
  }

  const pepProgress = Array.from(pepMap.values())
    .map((p) => ({
      ...p,
      pctReceived: p.totalOrdered > 0 ? Math.round((p.receivedQty / p.totalOrdered) * 1000) / 10 : 0,
      pctInTransit: p.totalOrdered > 0 ? Math.round((p.inTransitQty / p.totalOrdered) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.totalOrdered - a.totalOrdered);

  return {
    activePoCount: activePos.size,
    openItemCount: openItems.length,
    totalOpenQty,
    openValueByCurrency,
    onTimeCount,
    delayedCount,
    completedCount,
    onTimeRate,
    avgDelayDays,
    processCounts,
    drawbackFobBrl,
    fullTaxFobBrl,
    totalTaxesBrl,
    ncmSummary,
    pepProgress,
  };
}

function mapCanalLabel(ch: string): 'VERDE' | 'AMARELO' | 'VERMELHO' | 'CINZA' | '-' {
  if (ch === 'VD') return 'VERDE';
  if (ch === 'AM') return 'AMARELO';
  if (ch === 'VM') return 'VERMELHO';
  if (ch === 'CZ') return 'CINZA';
  return '-';
}

function inferShipmentStatus(items: FupItemRow[]): ShipmentOperationalStatus {
  const first = items[0];
  if (!first) return 'AG. PRONTIDAO DA CARGA';
  const allReceived = items.every((i) => i.QUANTIDADE_PENDENTE <= 0 || Boolean(i.DATA_ENTREGA_MFX) || Boolean(i.ULTIMA_DATA_RECEBIMENTO));
  if (allReceived && (first.DATA_ENTREGA_MFX || first.ULTIMA_DATA_RECEBIMENTO)) {
    return 'ENTREGUE';
  }
  const hasDrawbackExpectedButMissing = items.some((i) => isDrawbackExpectedNcm(i.FUP_NCMS) && !i.FUP_ATO_CONCESSORIO);
  if (hasDrawbackExpectedButMissing && first.FUP_DATA_PRESENCA_CARGA && !first.DATA_DESEMBARACO) {
    return 'PARADO AG. DRAWBACK';
  }
  if (first.FUP_DATA_PRESENCA_CARGA && !first.DATA_DESEMBARACO) {
    return 'AG. DESEMBARAÇO';
  }
  if (first.ETD || first.CONHECIMENTO_EMBARQUE) {
    return 'EM TRÂNSITO';
  }
  return 'AG. PRONTIDAO DA CARGA';
}

export function extractNfDocnumFromProcess(proc?: ProcessDetailJson): string {
  if (!proc) return '';
  for (const raw of [proc.DOCNUM, proc.NFENUM]) {
    if (raw === undefined || raw === null) continue;
    const s = String(raw).trim();
    if (!s || s === '-' || /^0+$/.test(s)) continue;
    return s;
  }
  return '';
}

export function findProcessJsonForRef(
  processos: ProcessDetailJson[] | undefined,
  procRef: string
): ProcessDetailJson {
  if (!Array.isArray(processos) || processos.length === 0) return {};
  const target = (procRef || '').trim();
  if (target) {
    const matched = processos.find(
      (p) => String(p?.NUM_PROCESSO || '').trim() === target
    );
    if (matched) return matched;
  }
  return processos[0] || {};
}

export function buildShipmentProcesses(
  items: FupItemRow[],
  overridesMap: Record<string, ShipmentOverrides>
): ShipmentProcessRow[] {
  const grouped = new Map<string, FupItemRow[]>();

  for (const item of items) {
    const ref = item.ULTIMO_PROCESSO_IMPORTACAO?.trim();
    if (!ref) continue;
    const list = grouped.get(ref) || [];
    list.push(item);
    grouped.set(ref, list);
  }

  const rows: ShipmentProcessRow[] = [];

  for (const [ref, groupItems] of grouped.entries()) {
    const primary = groupItems[0];
    const procJson = findProcessJsonForRef(primary.processos, ref);
    const ov = overridesMap[ref] || {};

    const poList = Array.from(new Set(groupItems.map((i) => i.PEDIDO).filter(Boolean))).join(', ');
    const acList = Array.from(new Set(groupItems.map((i) => i.FUP_ATO_CONCESSORIO).filter(Boolean))).join(', ');
    const linha = Array.from(new Set(groupItems.map((i) => i.DESCRICAO_ELEMENTO_PEP).filter(Boolean))).join(' / ');
    const miroList = Array.from(new Set(groupItems.map((i) => i.FUP_DOCUMENTOS_MIRO).filter(Boolean))).join(', ');
    const paidList = Array.from(new Set(groupItems.map((i) => i.FUP_DOCUMENTOS_COMPENSACAO).filter(Boolean))).join(', ');

    const currency = primary.MOEDA || 'USD';
    const taxaUsd =
      groupItems.find((i) => i.FUP_TAXA_DOLAR_PROCESSO > 0)?.FUP_TAXA_DOLAR_PROCESSO || 5.65;
    const taxaEur =
      groupItems.find((i) => i.FUP_TAXA_EURO_PROCESSO > 0)?.FUP_TAXA_EURO_PROCESSO || 6.12;
    const ptax = currency === 'BRL' ? 1 : currency === 'EUR' ? taxaEur : taxaUsd;

    const invoiceValue = groupItems.reduce((s, i) => s + i.VALOR_LIQUIDO, 0);
    const brlMercSum = groupItems.reduce((s, i) => s + i.FUP_VALOR_MERCADORIA, 0);
    const maxProcFob = Math.max(...groupItems.map((i) => i.FUP_VALOR_FOB_REAIS_PROCESSO), 0);
    const brlFob = brlMercSum > 0 ? brlMercSum : maxProcFob > 0 ? maxProcFob : invoiceValue * ptax;
    const usdFob = currency === 'USD' ? invoiceValue : brlFob / taxaUsd;

    const brlFrete = groupItems.reduce((s, i) => s + i.FUP_TOTAL_FRETE_FISCAL_ITEM, 0);
    const freightCost = ov.freightCost !== undefined ? ov.freightCost : ptax > 0 ? Math.round((brlFrete / ptax) * 100) / 100 : 0;
    const brlCifSum = groupItems.reduce((s, i) => s + i.FUP_VALOR_ADUANEIRO, 0);
    const brlCif = brlCifSum > 0 ? brlCifSum : brlFob + brlFrete + groupItems.reduce((s, i) => s + i.FUP_TOTAL_SEGURO_FISCAL_ITEM, 0);

    const impostos = groupItems.reduce(
      (s, i) =>
        s +
        i.FUP_TOTAL_II_ITEM +
        i.FUP_TOTAL_IPI_ITEM +
        i.FUP_TOTAL_PIS_ITEM +
        i.FUP_TOTAL_COFINS_ITEM +
        i.FUP_TOTAL_ICMS_ITEM +
        i.FUP_TOTAL_SISCOMEX_ITEM,
      0
    );

    const armazenagem = Math.max(...groupItems.map((i) => i.FUP_ARMAZENAGEM_PROCESSO), 0);
    const afrmm = Math.max(...groupItems.map((i) => i.FUP_AFRMM_PROCESSO), 0);

    const presenca = primary.FUP_DATA_PRESENCA_CARGA;
    const recebimento = primary.ULTIMA_DATA_RECEBIMENTO || primary.DATA_ENTREGA_MFX;
    const etd = primary.ETD;
    const eta = primary.ETA;

    const days = presenca && recebimento ? Math.max(0, daysBetween(presenca, recebimento)) : presenca ? Math.max(0, daysBetween(presenca, new Date().toISOString().slice(0, 10))) : 0;
    const periodos = days > 0 ? Math.ceil(days / 10) : 0;
    const transitTime = procJson.TRANSIT_TIME_ATUALIZADO || (etd && eta ? Math.max(0, daysBetween(etd, eta)) : 0);
    const leadTime = procJson.LEAD_TIME_ENTREGA || (etd && recebimento ? Math.max(0, daysBetween(etd, recebimento)) : 0);

    const trucking = ov.truckingCost ?? procJson.FRETE_NACIONAL ?? 0;
    const brokerFee = ov.brokerFee ?? procJson.BROKER_FEE ?? 0;
    const liFee = ov.liFee ?? procJson.LI_FEE ?? 0;
    const demurrage = ov.demurrageCost ?? procJson.DEMURRAGE_COST ?? 0;

    const totalCostBrl = armazenagem + trucking + brokerFee + brlFrete + liFee + demurrage + afrmm;
    const pctCostCif = brlCif > 0 ? Math.round((totalCostBrl / brlCif) * 10000) / 100 : 0;
    const pctCostFob = brlFob > 0 ? Math.round((totalCostBrl / brlFob) * 10000) / 100 : 0;

    const modalLabel =
      primary.FUP_TIPO_EMBARQUE === 'A'
        ? 'AÉREO'
        : primary.FUP_TIPO_EMBARQUE === 'M'
          ? 'MARÍTIMO'
          : primary.FUP_TIPO_EMBARQUE === 'R'
            ? 'RODOVIÁRIO'
            : '-';

    const regTrib =
      ov.regTrib ||
      procJson.REGIME_TRIBUTARIO ||
      (acList ? 'DRAWBACK SUSP.' : 'REC. INTEGRAL');

    rows.push({
      ref,
      resp: ov.resp || procJson.ANALYST || primary.NOME_COMPRADOR?.split(' ')[0] || 'COMEX',
      exporter: primary.NOME_FORNECEDOR || '-',
      linha: linha || '-',
      pi: ov.pi || procJson.PI_NUMBER || '-',
      poList,
      ac: acList || '-',

      agenteCarga: procJson.AGENTE || '-',
      ptax,
      freightCost,
      brlFrete,
      blAwb: primary.CONHECIMENTO_EMBARQUE || '-',
      master: procJson.NUM_MASTER || '-',
      modal: modalLabel,
      incoterm: primary.FUP_INCOTERM || '-',
      cntr: procJson.TIPO_CONTEINER || (primary.FUP_TIPO_EMBARQUE === 'A' ? 'LCL/AIR' : '-'),
      seal: procJson.LACRE || '-',
      ...(() => {
        const counts = parseContainerCounts(
          procJson.TIPO_CONTEINER,
          procJson.CONTAINERS_20,
          procJson.CONTAINERS_40
        );
        return { c20: counts.c20, c40: counts.c40 };
      })(),
      invPck: ov.invPckStatus || (procJson.INV_DO_EXPORTADOR ? 'OK' : 'PEND'),
      origBl: ov.origBlStatus || (primary.CONHECIMENTO_EMBARQUE ? 'OK' : 'PEND'),
      regTrib,
      acSub: ov.acSub || procJson.AC_SUB || (acList ? 'VINCULADO' : '-'),

      ie: procJson.INV_DO_EXPORTADOR || '-',
      broker: procJson.DESPACHANTE || 'OMEGA',
      valorPreAlert: invoiceValue,
      preAlert: ov.preAlertDate || (etd ? formatDateBr(etd) : '-'),
      diDraft: ov.diDraftDate || (primary.DATA_DI ? formatDateBr(primary.DATA_DI) : '-'),
      ptaxPreAlert: ptax,
      invoiceValue,
      currency,
      miro: miroList || '-',
      brlInvoice: brlFob,
      paid: paidList || '-',
      trackingNum: ov.trackingNum || procJson.TRACKING_NUM || '-',
      docBroker: ov.docBrokerDate || (primary.DATA_DI ? 'ENTREGUE' : 'AG. DOCS'),
      blBroker: ov.blBrokerDate || (primary.CONHECIMENTO_EMBARQUE ? 'OK' : 'PEND'),

      fromPort: procJson.PORTO_EMBRAQUE || '-',
      etd: formatDateBr(etd),
      transshipment: ov.transshipment || procJson.TRANSSHIPMENT || 'NA',
      transPort: ov.transshipmentPort || procJson.TRANSSHIPMENT_PORT || '-',
      transEta: ov.transEta || '-',
      transEtd: ov.transEtd || '-',
      eta: formatDateBr(eta),
      etaFactory: formatDateBr(primary.DATA_ENTREGA_MFX || primary.DATA_ENTREGA_PREVISTA),

      berthing: ov.berthingDate || procJson.BERTHING_DATE || formatDateBr(presenca),
      terminal: procJson.TERMINAL_ATRAC || '-',
      presenca: formatDateBr(presenca),
      numerario: ov.numerarioDate || formatDateBr(procJson.DATA_SOL_NUMERARIO),
      valorAdt: ov.valorAdt ?? procJson.VALOR_ADT ?? 0,
      registro: formatDateBr(primary.DATA_DI),
      diNum: primary.NUM_DI || '-',
      ptaxDi: ptax,
      impostos,
      afrmm,
      ecotax: ov.ecotax ?? procJson.ECOTAX ?? 0,
      canal: mapCanalLabel(primary.FUP_CANAL_PARAMETRIZACAO),
      desCi: formatDateBr(primary.DATA_DESEMBARACO),
      espelho: ov.espelho || (primary.NUM_DI ? 'EMITIDO' : '-'),
      minuta: ov.minuta || (primary.NUM_DI ? 'APROVADA' : '-'),
      ...(() => {
        const nfDoc = extractNfDocnumFromProcess(procJson);
        return {
          nfStatus: ov.nfStatus || (nfDoc ? 'EMITIDA' : '-'),
          nfNum: nfDoc || '-',
        };
      })(),
      transportadora: procJson.TRANSP_DI || '-',
      freteNac: trucking,
      recebimento: formatDateBr(recebimento),

      days,
      periodos,
      armazenagem,
      devCtnr: ov.devCtnrDate || formatDateBr(procJson.DT_DEVOL_CONTAINER),
      demurrage,
      transitTime,
      leadTime,

      warehouse: armazenagem,
      trucking,
      brokerFee,
      freightTotal: brlFrete,
      liFee,
      demurrageTotal: demurrage,
      totalCostBrl,
      brlCif,
      brlFob,
      usdFob,
      pctCostCif,
      pctCostFob,
      status: ov.status || inferShipmentStatus(groupItems),
      items: groupItems,
    });
  }

  return rows.sort((a, b) => a.ref.localeCompare(b.ref));
}

export function buildOrderStatusMatrix(
  items: FupItemRow[],
  overridesMap: Record<string, ShipmentOverrides>,
  separateByEtaDate = false
): OrderStatusMatrixData {
  // Pre-collect process-level POs, BL/AWB, NF (DOCNUM from col AQ PROCESSOS_JSON), ETD, and ETA for cargo already at BL
  const procMetaMap = new Map<
    string,
    {
      poSet: Set<string>;
      blSet: Set<string>;
      nfSet: Set<string>;
      etdIso: string;
      etaIso: string;
    }
  >();

  const ensureProcMeta = (ref: string) => {
    let meta = procMetaMap.get(ref);
    if (!meta) {
      meta = {
        poSet: new Set(),
        blSet: new Set(),
        nfSet: new Set(),
        etdIso: '',
        etaIso: '',
      };
      procMetaMap.set(ref, meta);
    }
    return meta;
  };

  for (const item of items) {
    if (Array.isArray(item.processos)) {
      for (const p of item.processos) {
        const pRef = String(p?.NUM_PROCESSO || '').trim();
        if (!pRef) continue;
        const pMeta = ensureProcMeta(pRef);
        if (item.PEDIDO) pMeta.poSet.add(item.PEDIDO);
        const pBl = (
          p.CONHECIMENTO_EMBARQUE ||
          p.NUM_CONHECIMENTO ||
          p.NUM_BL ||
          p.BL_AWB ||
          p.NUM_MASTER ||
          ''
        ).trim();
        if (pBl) pMeta.blSet.add(pBl);
        const pNf = extractNfDocnumFromProcess(p);
        if (pNf) pMeta.nfSet.add(pNf);
      }
    }

    const procRef = item.ULTIMO_PROCESSO_IMPORTACAO;
    if (!procRef) continue;
    const meta = ensureProcMeta(procRef);
    if (item.PEDIDO) meta.poSet.add(item.PEDIDO);
    const procJson = findProcessJsonForRef(item.processos, procRef);
    const blVal = (
      item.CONHECIMENTO_EMBARQUE ||
      procJson.CONHECIMENTO_EMBARQUE ||
      procJson.NUM_CONHECIMENTO ||
      procJson.NUM_BL ||
      procJson.BL_AWB ||
      procJson.NUM_MASTER ||
      ''
    ).trim();
    if (blVal) meta.blSet.add(blVal);
    const nfVal = extractNfDocnumFromProcess(procJson);
    if (nfVal) meta.nfSet.add(nfVal);
    const etdCandidate = item.ETD || item.DATA_PROGRAMACAO_FORNECIMENTO || '';
    const etaCandidate = item.ETA || item.DATA_ENTREGA_PREVISTA || '';
    if (!meta.etdIso && etdCandidate) meta.etdIso = etdCandidate;
    if (!meta.etaIso && etaCandidate) meta.etaIso = etaCandidate;
  }

  const colMap = new Map<
    string,
    MatrixColumnMeta & {
      _poSet: Set<string>;
      _blSet: Set<string>;
      _nfSet: Set<string>;
    }
  >();

  const getItemColKey = (item: FupItemRow): {
    key: string;
    isBl: boolean;
    number: string;
    etdIso: string;
    etaIso: string;
    itemBl: string;
    itemNf: string;
  } => {
    const isBl = Boolean(item.ULTIMO_PROCESSO_IMPORTACAO);
    const number = isBl ? item.ULTIMO_PROCESSO_IMPORTACAO : item.PEDIDO;
    const procMeta = isBl ? procMetaMap.get(number) : undefined;
    const etdIso =
      (isBl
        ? item.ETD || procMeta?.etdIso || item.DATA_PROGRAMACAO_FORNECIMENTO
        : item.ETD || item.DATA_PROGRAMACAO_FORNECIMENTO) || '';
    const etaIso =
      (isBl
        ? item.ETA || procMeta?.etaIso || item.DATA_ENTREGA_PREVISTA
        : item.ETA || item.DATA_ENTREGA_PREVISTA) || '';
    const procJson = isBl
      ? findProcessJsonForRef(item.processos, number)
      : item.processos?.[0] || {};
    const itemBl = (
      item.CONHECIMENTO_EMBARQUE ||
      procJson.CONHECIMENTO_EMBARQUE ||
      procJson.NUM_CONHECIMENTO ||
      procJson.NUM_BL ||
      procJson.BL_AWB ||
      procJson.NUM_MASTER ||
      ''
    ).trim();
    const itemNf = isBl ? extractNfDocnumFromProcess(procJson) : '';
    const baseKey = isBl ? `BL:${number}` : `PO:${number}`;
    const key = separateByEtaDate ? `${baseKey}@${etaIso || 'NO_ETA'}` : baseKey;
    return { key, isBl, number, etdIso, etaIso, itemBl, itemNf };
  };

  for (const item of items) {
    const { key, isBl, number, etdIso, etaIso, itemBl, itemNf } = getItemColKey(item);
    if (!number) continue;

    const existing = colMap.get(key);
    const ov = isBl ? overridesMap[number] : overridesMap[item.PEDIDO];
    const paymentStr = ov?.paymentDate || formatDateBr(item.DATA_ULTIMA_MIRO);
    const etdStr = formatDateBr(etdIso);
    const etaStr = formatDateBr(etaIso);
    const procMeta = isBl ? procMetaMap.get(number) : undefined;

    if (!existing) {
      const poSet = new Set<string>(procMeta ? Array.from(procMeta.poSet) : []);
      if (item.PEDIDO) poSet.add(item.PEDIDO);
      const blSet = new Set<string>(procMeta ? Array.from(procMeta.blSet) : []);
      if (itemBl) blSet.add(itemBl);
      const nfSet = new Set<string>(procMeta ? Array.from(procMeta.nfSet) : []);
      if (itemNf) nfSet.add(itemNf);

      colMap.set(key, {
        key,
        kind: isBl ? 'BL' : 'PO',
        number,
        poNumbers: Array.from(poSet).join(', ') || '-',
        blAwb: Array.from(blSet).join(', ') || '-',
        nfDocnum: Array.from(nfSet).join(', ') || '-',
        supplier: item.NOME_FORNECEDOR || '-',
        payment: paymentStr,
        advValue: item.VALOR_LIQUIDO,
        currency: item.MOEDA || 'USD',
        etd: etdStr,
        eta: etaStr,
        etaIso,
        _poSet: poSet,
        _blSet: blSet,
        _nfSet: nfSet,
      });
    } else {
      existing.advValue += item.VALOR_LIQUIDO;
      if (item.PEDIDO) {
        existing._poSet.add(item.PEDIDO);
        existing.poNumbers = Array.from(existing._poSet).join(', ') || '-';
      }
      if (itemBl) {
        existing._blSet.add(itemBl);
        existing.blAwb = Array.from(existing._blSet).join(', ') || '-';
      }
      if (itemNf) {
        existing._nfSet.add(itemNf);
        existing.nfDocnum = Array.from(existing._nfSet).join(', ') || '-';
      }
      if (existing.payment === '-' && paymentStr !== '-') existing.payment = paymentStr;
      if (existing.etd === '-' && etdStr !== '-') existing.etd = etdStr;
      if (existing.eta === '-' && etaStr !== '-') {
        existing.eta = etaStr;
        existing.etaIso = etaIso;
      }
    }
  }

  const columns: MatrixColumnMeta[] = Array.from(colMap.values())
    .map(({ _poSet, _blSet, _nfSet, ...col }) => col)
    .sort((a, b) => {
      if (separateByEtaDate) {
        const etaA = a.etaIso || '9999-99-99';
        const etaB = b.etaIso || '9999-99-99';
        if (etaA !== etaB) return etaA.localeCompare(etaB);
        if (a.kind !== b.kind) return a.kind === 'PO' ? -1 : 1;
        return a.number.localeCompare(b.number);
      }
      // Default: Sort POs first, then BLs, by number
      if (a.kind !== b.kind) return a.kind === 'PO' ? -1 : 1;
      return a.number.localeCompare(b.number);
    });

  // Group by Project PEP -> Material
  const sectionMap = new Map<
    string,
    {
      sectionKey: string;
      pepCode: string;
      pepDescription: string;
      materialsMap: Map<string, MatrixMaterialRow>;
    }
  >();

  for (const item of items) {
    const pepDesc = item.DESCRICAO_ELEMENTO_PEP || 'GERAL / SEM ELEMENTO PEP';
    const pepCode = item.ELEMENTO_PEP_INTERNO || '-';
    const sectionKey = `${pepCode}::${pepDesc}`;
    let section = sectionMap.get(sectionKey);
    if (!section) {
      section = {
        sectionKey,
        pepCode,
        pepDescription: pepDesc,
        materialsMap: new Map(),
      };
      sectionMap.set(sectionKey, section);
    }

    const matKey = item.MATERIAL || item.DESCRICAO_MATERIAL || item.id;
    let matRow = section.materialsMap.get(matKey);
    if (!matRow) {
      matRow = {
        rowKey: `${sectionKey}::${matKey}`,
        materialCode: item.MATERIAL,
        descPt: item.DESCRICAO_MATERIAL,
        descEn: item.DESCRICAO_MATERIAL_INGLES || '-',
        ncm: item.FUP_NCMS || '-',
        um: item.UNIDADE || 'UND',
        estoque: item.ESTOQUE_SOMA_TRES_CATEGORIAS_PLANTA_0003,
        elementoPep: item.DESCRICAO_ELEMENTO_PEP || item.ELEMENTO_PEP_INTERNO || '-',
        elementoPepCode: item.ELEMENTO_PEP_INTERNO || '',
        quantities: {},
        qtdAcDefault: 0,
        acNumber: item.FUP_ATO_CONCESSORIO,
      };
      section.materialsMap.set(matKey, matRow);
    }

    const { key: colKey, isBl } = getItemColKey(item);
    const qtyForCol = isBl
      ? item.FUP_QUANTIDADE_DI > 0
        ? item.FUP_QUANTIDADE_DI
        : item.QUANTIDADE_PEDIDA
      : item.QUANTIDADE_PENDENTE > 0
        ? item.QUANTIDADE_PENDENTE
        : item.QUANTIDADE_PEDIDA;

    matRow.quantities[colKey] = (matRow.quantities[colKey] || 0) + qtyForCol;
    if (item.FUP_ATO_CONCESSORIO) {
      matRow.qtdAcDefault += item.QUANTIDADE_PEDIDA;
      if (!matRow.acNumber) matRow.acNumber = item.FUP_ATO_CONCESSORIO;
    }
  }

  const sections: MatrixProjectSection[] = Array.from(sectionMap.values()).map((sec) => ({
    sectionKey: sec.sectionKey,
    pepCode: sec.pepCode,
    pepDescription: sec.pepDescription,
    label: sec.pepCode !== '-' ? `${sec.pepDescription} (${sec.pepCode})` : sec.pepDescription,
    materials: Array.from(sec.materialsMap.values()).sort((a, b) =>
      a.materialCode.localeCompare(b.materialCode)
    ),
  }));

  return { columns, sections };
}

export function buildCashFlowData(
  items: FupItemRow[],
  processes: ShipmentProcessRow[]
): CashFlowEntry[] {
  const entries: CashFlowEntry[] = [];
  const seenFinKeys = new Set<string>();

  for (const item of items) {
    const rate =
      item.MOEDA === 'EUR'
        ? item.FUP_TAXA_EURO_PROCESSO || 6.12
        : item.FUP_TAXA_DOLAR_PROCESSO || 5.65;

    // 1. Parse FINANCEIRO_JSON & FATURAS_JSON entries
    if (item.financeiro.length > 0) {
      for (const fin of item.financeiro) {
        const uniq = `${fin.FI_BELNR}-${fin.MIRO_BELNR || item.PEDIDO}`;
        if (seenFinKeys.has(uniq)) continue;
        seenFinKeys.add(uniq);

        const matchingFatura = item.faturas.find((f) => f.MIRO_BELNR === fin.MIRO_BELNR) || item.faturas[0];
        const curr = fin.WAERS || item.MOEDA || 'USD';
        const finRate = curr === 'BRL' ? 1 : curr === 'EUR' ? item.FUP_TAXA_EURO_PROCESSO || 6.12 : item.FUP_TAXA_DOLAR_PROCESSO || 5.65;
        const isPaid = Boolean(fin.AUGBL) || fin.STATUS === 'PAGO';
        const todayIso = new Date().toISOString().slice(0, 10);
        const dueIso = fin.NETDT || '';
        const status: CashFlowEntry['status'] = isPaid
          ? 'PAGO'
          : fin.STATUS === 'VENCIDA' || (dueIso && dueIso < todayIso)
            ? 'VENCIDA'
            : 'A VENCER';

        entries.push({
          id: `FIN-${uniq}`,
          source: 'MIRO/FI',
          reference: `PO ${item.PEDIDO}`,
          processRef: item.ULTIMO_PROCESSO_IMPORTACAO || '-',
          partner: item.NOME_FORNECEDOR,
          documentNumber: `MIRO ${fin.MIRO_BELNR || matchingFatura?.MIRO_BELNR || '-'} / FI ${fin.FI_BELNR}`,
          issueDate: matchingFatura?.BLDAT || item.DATA_ULTIMA_MIRO || item.DATA_PEDIDO,
          dueDate: dueIso || item.DATA_ENTREGA_PREVISTA,
          clearingDate: fin.AUGDT || '',
          clearingDoc: fin.AUGBL || '',
          amount: fin.WRBTR,
          currency: curr,
          amountBrl: fin.WRBTR * finRate,
          status,
          category: 'Fatura Fornecedor (Material)',
        });
      }
    } else if (item.faturas.length > 0) {
      for (const fat of item.faturas) {
        const uniq = `FAT-${fat.MIRO_BELNR}-${item.PEDIDO}`;
        if (seenFinKeys.has(uniq)) continue;
        seenFinKeys.add(uniq);

        const curr = fat.WAERS || item.MOEDA || 'USD';
        const finRate = curr === 'BRL' ? 1 : rate;
        entries.push({
          id: uniq,
          source: 'MIRO/FI',
          reference: `PO ${item.PEDIDO}`,
          processRef: item.ULTIMO_PROCESSO_IMPORTACAO || '-',
          partner: item.NOME_FORNECEDOR,
          documentNumber: `MIRO ${fat.MIRO_BELNR}`,
          issueDate: fat.BLDAT || fat.BUDAT || item.DATA_PEDIDO,
          dueDate: item.DATA_ENTREGA_PREVISTA || '',
          clearingDate: '',
          clearingDoc: item.FUP_DOCUMENTOS_COMPENSACAO || '',
          amount: fat.RMWWR,
          currency: curr,
          amountBrl: fat.RMWWR * finRate,
          status: item.FUP_QTD_MIRO_VENCIDAS > 0 ? 'VENCIDA' : item.FUP_DOCUMENTOS_COMPENSACAO ? 'PAGO' : 'A VENCER',
          category: 'Fatura Fornecedor (Material)',
        });
      }
    } else if (item.QUANTIDADE_PENDENTE > 0 && item.VALOR_LIQUIDO > 0) {
      // Projected PO payment
      const ratio = item.QUANTIDADE_PEDIDA > 0 ? item.QUANTIDADE_PENDENTE / item.QUANTIDADE_PEDIDA : 1;
      const val = item.VALOR_LIQUIDO * ratio;
      entries.push({
        id: `PROJ-PO-${item.id}`,
        source: 'MIRO/FI',
        reference: `PO ${item.PEDIDO}`,
        processRef: item.ULTIMO_PROCESSO_IMPORTACAO || '-',
        partner: item.NOME_FORNECEDOR,
        documentNumber: 'PROJEÇÃO CONTRATUAL',
        issueDate: item.DATA_PEDIDO,
        dueDate: item.ETA || item.DATA_ENTREGA_PREVISTA,
        clearingDate: '',
        clearingDoc: '',
        amount: val,
        currency: item.MOEDA || 'USD',
        amountBrl: val * rate,
        status: 'PROJETADO',
        category: 'Previsão Fornecedor (Open PO)',
      });
    }
  }

  // 2. Add Logistics & Customs Clearance cash flow lines per MFX process
  for (const proc of processes) {
    const baseDate = proc.items[0]?.FUP_DATA_PRESENCA_CARGA || proc.items[0]?.ETA || proc.items[0]?.DATA_ENTREGA_PREVISTA || '';
    if (proc.freightTotal > 0) {
      entries.push({
        id: `LOG-FREIGHT-${proc.ref}`,
        source: 'LOGISTICS',
        reference: proc.ref,
        processRef: proc.ref,
        partner: proc.agenteCarga !== '-' ? proc.agenteCarga : 'Agente de Carga',
        documentNumber: proc.blAwb !== '-' ? `BL/AWB ${proc.blAwb}` : 'FRETE INTL',
        issueDate: proc.items[0]?.ETD || baseDate,
        dueDate: proc.items[0]?.ETA || baseDate,
        clearingDate: proc.status === 'ENTREGUE' ? proc.items[0]?.ULTIMA_DATA_RECEBIMENTO || '' : '',
        clearingDoc: proc.status === 'ENTREGUE' ? 'LIQUIDADO' : '',
        amount: proc.freightTotal,
        currency: 'BRL',
        amountBrl: proc.freightTotal,
        status: proc.status === 'ENTREGUE' ? 'PAGO' : 'A VENCER',
        category: 'Frete Internacional',
      });
    }
    const portAndServices = proc.warehouse + proc.afrmm + proc.brokerFee + proc.trucking + proc.liFee + proc.demurrageTotal;
    if (portAndServices > 0) {
      entries.push({
        id: `LOG-PORT-${proc.ref}`,
        source: 'LOGISTICS',
        reference: proc.ref,
        processRef: proc.ref,
        partner: `${proc.broker} / ${proc.terminal !== '-' ? proc.terminal : 'Terminal'}`,
        documentNumber: proc.diNum !== '-' ? `DI ${proc.diNum}` : 'NUMERÁRIO',
        issueDate: proc.items[0]?.FUP_DATA_PRESENCA_CARGA || baseDate,
        dueDate: proc.items[0]?.DATA_DESEMBARACO || baseDate,
        clearingDate: proc.status === 'ENTREGUE' ? proc.items[0]?.ULTIMA_DATA_RECEBIMENTO || '' : '',
        clearingDoc: proc.status === 'ENTREGUE' ? 'LIQUIDADO' : '',
        amount: portAndServices,
        currency: 'BRL',
        amountBrl: portAndServices,
        status: proc.status === 'ENTREGUE' ? 'PAGO' : 'A VENCER',
        category: 'Armazenagem, AFRMM & Desembaraço',
      });
    }
    if (proc.impostos > 0) {
      entries.push({
        id: `TAX-${proc.ref}`,
        source: 'CUSTOMS/TAXES',
        reference: proc.ref,
        processRef: proc.ref,
        partner: 'Receita Federal / SEFAZ',
        documentNumber: proc.diNum !== '-' ? `DI ${proc.diNum}` : 'TRIBUTOS IMP.',
        issueDate: proc.items[0]?.DATA_DI || baseDate,
        dueDate: proc.items[0]?.DATA_DI || baseDate,
        clearingDate: proc.items[0]?.DATA_DESEMBARACO || '',
        clearingDoc: proc.items[0]?.DATA_DESEMBARACO ? 'DARF/GARE' : '',
        amount: proc.impostos,
        currency: 'BRL',
        amountBrl: proc.impostos,
        status: proc.items[0]?.DATA_DESEMBARACO ? 'PAGO' : 'A VENCER',
        category: 'Impostos Aduaneiros (II/IPI/PIS/COFINS/ICMS)',
      });
    }
  }

  return entries.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
}

export function generateAutoSwot(partner: Omit<PartnerScorecard, 'autoSwot'>): SwotData {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const opportunities: string[] = [];
  const threats: string[] = [];

  if (partner.category === 'SUPPLIER') {
    if (partner.onTimeRate >= 85) {
      strengths.push(`Alta confiabilidade de entrega: ${partner.onTimeRate}% dos itens no prazo.`);
    } else if (partner.onTimeRate >= 60) {
      strengths.push(`Fornecedor homologado com ${partner.poOrProcessCount} pedidos/itens ativos.`);
    }
    if (partner.drawbackCoverageRate >= 70) {
      strengths.push(`Forte aderência ao Drawback (${partner.drawbackCoverageRate}% sob Ato Concessório).`);
    }
    if (partner.avgDelayDays > 10) {
      weaknesses.push(`Atraso médio elevado de ${partner.avgDelayDays} dias em relação à data prevista (EINDT).`);
    } else if (partner.onTimeRate < 75) {
      weaknesses.push(`Índice de entregas no prazo abaixo da meta (${partner.onTimeRate}% vs. meta 85%).`);
    }
    if (partner.openQty > 0) {
      opportunities.push(`Consolidar saldo aberto (${partner.openQty.toLocaleString('pt-BR')} unid.) para otimização de frete.`);
    }
    if (partner.drawbackCoverageRate < 50) {
      opportunities.push(`Revisar enquadramento de NCMs elegíveis para inclusão em Ato Concessório Drawback.`);
    }
    if (partner.airCount > partner.seaCount && partner.airCount > 0) {
      threats.push(`Dependência de modal aéreo (${partner.airCount} embarques) pressiona o custo logístico total.`);
    }
    if (partner.avgDelayDays > 15) {
      threats.push(`Risco de ruptura no cronograma de projetos PEP devido a desvios recorrentes de ETD.`);
    }
  } else if (partner.category === 'FORWARDER') {
    if (partner.avgTransitTime > 0 && partner.avgTransitTime <= 25) {
      strengths.push(`Transit time competitivo (média de ${partner.avgTransitTime} dias).`);
    }
    if (partner.freightPctOverFob > 0 && partner.freightPctOverFob <= 8) {
      strengths.push(`Eficiência tarifária: frete representa ${partner.freightPctOverFob}% do FOB.`);
    }
    if (partner.freightPctOverFob > 12) {
      weaknesses.push(`Custo de frete acima do benchmark (${partner.freightPctOverFob}% sobre FOB).`);
    }
    if (partner.avgTransitTime > 32) {
      weaknesses.push(`Transit time estendido (${partner.avgTransitTime} dias) reduz margem de segurança.`);
    }
    opportunities.push(`Negociar tabela LCL/FCL anual e free time estendido de demurrage (14–21 dias).`);
    if (partner.airCount > 0) {
      threats.push(`Volatilidade de tarifas aéreas e risco de roll-over em conexões internacionais.`);
    } else {
      threats.push(`Omissão de escalas marítimas e congestionamento portuário elevando risco de armazenagem.`);
    }
  } else {
    // BROKER
    if (partner.avgClearanceDays > 0 && partner.avgClearanceDays <= 5) {
      strengths.push(`Agilidade no desembaraço aduaneiro (média de ${partner.avgClearanceDays} dias após presença).`);
    } else {
      strengths.push(`Gestão consolidada de ${partner.poOrProcessCount} processos de importação MFX.`);
    }
    if (partner.storagePeriodIncidence > 1.5) {
      weaknesses.push(`Incidência média de ${partner.storagePeriodIncidence} períodos de armazenagem por processo.`);
    }
    opportunities.push(`Antecipar registro de DUIMP / DI via pré-conferência documental antes da atracação.`);
    threats.push(`Parametrização em Canal Amarelo/Vermelho ou pendência de Ato Concessório gerando custos extras.`);
  }

  if (strengths.length === 0) strengths.push('Parceria operacional ativa com histórico integrado ao SAP Comex.');
  if (weaknesses.length === 0) weaknesses.push('Necessidade de padronização contínua de documentos pré-embarque.');
  if (opportunities.length === 0) opportunities.push('Automação de Pre-Alert e integração direta de cronograma ETD/ETA.');
  if (threats.length === 0) threats.push('Oscilação cambial (Ptax) e alterações regulatórias aduaneiras (DUIMP).');

  return { strengths, weaknesses, opportunities, threats };
}

export function buildPartnerScorecards(
  items: FupItemRow[],
  processes: ShipmentProcessRow[]
): PartnerScorecard[] {
  const cards: PartnerScorecard[] = [];

  // 1. Material Suppliers
  const supMap = new Map<string, FupItemRow[]>();
  for (const item of items) {
    if (!item.NOME_FORNECEDOR || item.LOEKZ === 'L') continue;
    const list = supMap.get(item.NOME_FORNECEDOR) || [];
    list.push(item);
    supMap.set(item.NOME_FORNECEDOR, list);
  }

  for (const [name, list] of supMap.entries()) {
    const pos = new Set(list.map((i) => i.PEDIDO));
    const totalUsd = list.reduce(
      (s, i) => s + (i.MOEDA === 'USD' ? i.VALOR_LIQUIDO : i.VALOR_LIQUIDO * 1.08),
      0
    );
    const totalBrl = list.reduce(
      (s, i) =>
        s +
        (i.FUP_VALOR_FOB_REAIS_PROCESSO > 0
          ? i.FUP_VALOR_FOB_REAIS_PROCESSO
          : i.VALOR_LIQUIDO * (i.FUP_TAXA_DOLAR_PROCESSO || 5.65)),
      0
    );
    const openQty = list.reduce((s, i) => s + i.QUANTIDADE_PENDENTE, 0);
    const deliveredQty = list.reduce((s, i) => s + i.QUANTIDADE_RECEBIDA_LIQUIDA, 0);
    const onTimeCount = list.filter((i) => i.STATUS_PRAZO_ENTREGA === 'NO PRAZO' || i.STATUS_PRAZO_ENTREGA === 'ENTREGA CONCLUIDA SAP').length;
    const delayed = list.filter((i) => i.STATUS_PRAZO_ENTREGA === 'ATRASADO');
    const onTimeRate = list.length > 0 ? Math.round((onTimeCount / list.length) * 1000) / 10 : 100;
    const avgDelayDays =
      delayed.length > 0
        ? Math.round((delayed.reduce((s, i) => s + Math.max(0, i.DIAS_ATRASO_ENTREGA), 0) / delayed.length) * 10) / 10
        : 0;
    const airCount = list.filter((i) => i.FUP_TIPO_EMBARQUE === 'A').length;
    const seaCount = list.filter((i) => i.FUP_TIPO_EMBARQUE === 'M').length;
    const drawbackCount = list.filter((i) => Boolean(i.FUP_ATO_CONCESSORIO)).length;
    const drawbackCoverageRate = list.length > 0 ? Math.round((drawbackCount / list.length) * 1000) / 10 : 0;

    const base = {
      id: `SUPPLIER::${name}`,
      name,
      category: 'SUPPLIER' as const,
      poOrProcessCount: pos.size,
      totalValueUsd: totalUsd,
      totalValueBrl: totalBrl,
      openQty,
      deliveredQty,
      onTimeRate,
      avgDelayDays,
      avgTransitTime: 0,
      avgClearanceDays: 0,
      storagePeriodIncidence: 0,
      airCount,
      seaCount,
      freightPctOverFob: 0,
      drawbackCoverageRate,
    };
    cards.push({ ...base, autoSwot: generateAutoSwot(base) });
  }

  // 2. Freight Forwarders
  const fwdMap = new Map<string, ShipmentProcessRow[]>();
  for (const proc of processes) {
    if (!proc.agenteCarga || proc.agenteCarga === '-') continue;
    const list = fwdMap.get(proc.agenteCarga) || [];
    list.push(proc);
    fwdMap.set(proc.agenteCarga, list);
  }

  for (const [name, list] of fwdMap.entries()) {
    const airCount = list.filter((p) => p.modal === 'AÉREO').length;
    const seaCount = list.filter((p) => p.modal === 'MARÍTIMO').length;
    const ttList = list.filter((p) => p.transitTime > 0);
    const avgTransitTime =
      ttList.length > 0 ? Math.round((ttList.reduce((s, p) => s + p.transitTime, 0) / ttList.length) * 10) / 10 : 0;
    const totalFob = list.reduce((s, p) => s + p.brlFob, 0);
    const totalFrete = list.reduce((s, p) => s + p.freightTotal, 0);
    const freightPctOverFob = totalFob > 0 ? Math.round((totalFrete / totalFob) * 1000) / 10 : 0;

    const base = {
      id: `FORWARDER::${name}`,
      name,
      category: 'FORWARDER' as const,
      poOrProcessCount: list.length,
      totalValueUsd: list.reduce((s, p) => s + p.usdFob, 0),
      totalValueBrl: totalFrete,
      openQty: 0,
      deliveredQty: 0,
      onTimeRate: 100,
      avgDelayDays: 0,
      avgTransitTime,
      avgClearanceDays: 0,
      storagePeriodIncidence: 0,
      airCount,
      seaCount,
      freightPctOverFob,
      drawbackCoverageRate: 0,
    };
    cards.push({ ...base, autoSwot: generateAutoSwot(base) });
  }

  // 3. Customs Brokers
  const brkMap = new Map<string, ShipmentProcessRow[]>();
  for (const proc of processes) {
    if (!proc.broker || proc.broker === '-') continue;
    const list = brkMap.get(proc.broker) || [];
    list.push(proc);
    brkMap.set(proc.broker, list);
  }

  for (const [name, list] of brkMap.entries()) {
    const cleared = list.filter((p) => p.items[0]?.FUP_DATA_PRESENCA_CARGA && p.items[0]?.DATA_DESEMBARACO);
    const avgClearanceDays =
      cleared.length > 0
        ? Math.round(
            (cleared.reduce(
              (s, p) =>
                s +
                Math.max(
                  1,
                  daysBetween(p.items[0].FUP_DATA_PRESENCA_CARGA, p.items[0].DATA_DESEMBARACO)
                ),
              0
            ) /
              cleared.length) *
              10
          ) / 10
        : 0;
    const storagePeriodIncidence =
      list.length > 0
        ? Math.round((list.reduce((s, p) => s + p.periodos, 0) / list.length) * 10) / 10
        : 0;

    const base = {
      id: `BROKER::${name}`,
      name,
      category: 'BROKER' as const,
      poOrProcessCount: list.length,
      totalValueUsd: list.reduce((s, p) => s + p.usdFob, 0),
      totalValueBrl: list.reduce((s, p) => s + p.impostos + p.brokerFee, 0),
      openQty: 0,
      deliveredQty: 0,
      onTimeRate: 100,
      avgDelayDays: 0,
      avgTransitTime: 0,
      avgClearanceDays,
      storagePeriodIncidence,
      airCount: list.filter((p) => p.modal === 'AÉREO').length,
      seaCount: list.filter((p) => p.modal === 'MARÍTIMO').length,
      freightPctOverFob: 0,
      drawbackCoverageRate: 0,
    };
    cards.push({ ...base, autoSwot: generateAutoSwot(base) });
  }

  return cards;
}

export function parseContainerCounts(
  tipoConteiner?: string,
  explicit20?: number,
  explicit40?: number
): { c20: number; c40: number } {
  const raw = (tipoConteiner || '').toUpperCase();

  let c20 = 0;
  if (typeof explicit20 === 'number' && !Number.isNaN(explicit20)) {
    c20 = Math.max(0, explicit20);
  } else {
    const match20 = [...raw.matchAll(/(\d+)\s*[X×*]\s*20(?!\d)/g)];
    if (match20.length > 0) {
      c20 = match20.reduce((sum, m) => sum + Number(m[1] || 0), 0);
    } else if (/(?<!\d)20(?!\d)/.test(raw)) {
      c20 = 1;
    }
  }

  let c40 = 0;
  if (typeof explicit40 === 'number' && !Number.isNaN(explicit40)) {
    c40 = Math.max(0, explicit40);
  } else {
    const match40 = [...raw.matchAll(/(\d+)\s*[X×*]\s*40(?!\d)/g)];
    if (match40.length > 0) {
      c40 = match40.reduce((sum, m) => sum + Number(m[1] || 0), 0);
    } else if (/(?<!\d)40(?!\d)/.test(raw)) {
      c40 = 1;
    }
  }

  return { c20, c40 };
}

export interface DirectorChartMetrics {
  totalProcesses: number;
  registeredDiCount: number;
  channelBreakdown: Array<{
    key: 'VERDE' | 'AMARELO' | 'VERMELHO' | 'CINZA' | '-';
    label: string;
    count: number;
    pct: number;
    fobBrl: number;
    color: string;
  }>;
  containerAndModal: {
    total20: number;
    total40: number;
    totalContainers: number;
    totalTeus: number;
    seaCount: number;
    airCount: number;
    roadCount: number;
    demurrageWatchCount: number;
    modalChartData: Array<{
      label: string;
      count: number;
      teus: number;
      color: string;
    }>;
  };
  processPipeline: Array<{
    stage: ShipmentOperationalStatus;
    label: string;
    count: number;
    pct: number;
    fobBrl: number;
    color: string;
  }>;
  timingMetrics: {
    avgTransitDays: number;
    avgClearanceDays: number;
    avgStorageDays: number;
    avgLeadTimeDays: number;
    perProcess: Array<{
      processRef: string;
      shortRef: string;
      exporterShort: string;
      transitDays: number;
      clearanceDays: number;
      storageDays: number;
      leadTimeDays: number;
      canal: string;
    }>;
  };
}

export function computeDirectorChartMetrics(processes: ShipmentProcessRow[]): DirectorChartMetrics {
  const totalProcesses = processes.length;
  const registeredDiCount = processes.filter((p) => p.canal !== '-').length;

  const channelMeta: Array<{
    key: 'VERDE' | 'AMARELO' | 'VERMELHO' | 'CINZA' | '-';
    label: string;
    color: string;
  }> = [
    { key: 'VERDE', label: 'Canal Verde', color: '#10b981' },
    { key: 'AMARELO', label: 'Canal Amarelo', color: '#f59e0b' },
    { key: 'VERMELHO', label: 'Canal Vermelho', color: '#f43f5e' },
    { key: 'CINZA', label: 'Canal Cinza', color: '#64748b' },
    { key: '-', label: 'Aguardando DI', color: '#06b6d4' },
  ];

  const channelBreakdown = channelMeta.map((meta) => {
    const matched = processes.filter((p) => p.canal === meta.key);
    const count = matched.length;
    const pct = totalProcesses > 0 ? Math.round((count / totalProcesses) * 1000) / 10 : 0;
    const fobBrl = matched.reduce((sum, p) => sum + p.brlFob, 0);
    return { ...meta, count, pct, fobBrl };
  });

  const total20 = processes.reduce((s, p) => s + p.c20, 0);
  const total40 = processes.reduce((s, p) => s + p.c40, 0);
  const totalContainers = total20 + total40;
  const totalTeus = total20 + total40 * 2;
  const seaCount = processes.filter((p) => p.modal === 'MARÍTIMO').length;
  const airCount = processes.filter((p) => p.modal === 'AÉREO').length;
  const roadCount = processes.filter((p) => p.modal === 'RODOVIÁRIO').length;
  const demurrageWatchCount = processes.filter(
    (p) => (p.c20 + p.c40 > 0 && p.status !== 'ENTREGUE') || p.demurrage > 0
  ).length;

  const modalChartData: DirectorChartMetrics['containerAndModal']['modalChartData'] = [
    { label: "20' CNTR", count: total20, teus: total20, color: '#06b6d4' },
    { label: "40' CNTR", count: total40, teus: total40 * 2, color: '#6366f1' },
    { label: 'Aéreo', count: airCount, teus: 0, color: '#f59e0b' },
  ];
  if (roadCount > 0) {
    modalChartData.push({ label: 'Rodoviário', count: roadCount, teus: 0, color: '#10b981' });
  }

  const stageMeta: Array<{
    stage: ShipmentOperationalStatus;
    label: string;
    color: string;
  }> = [
    { stage: 'AG. PRONTIDAO DA CARGA', label: 'Ag. Prontidão', color: '#64748b' },
    { stage: 'EM TRÂNSITO', label: 'Em Trânsito', color: '#06b6d4' },
    { stage: 'AG. DESEMBARAÇO', label: 'Ag. Desembaraço', color: '#f59e0b' },
    { stage: 'PARADO AG. DRAWBACK', label: 'Parado Drawback', color: '#f43f5e' },
    { stage: 'ENTREGUE', label: 'Entregue MFX', color: '#10b981' },
  ];

  const processPipeline = stageMeta.map((meta) => {
    const matched = processes.filter((p) => p.status === meta.stage);
    const count = matched.length;
    const pct = totalProcesses > 0 ? Math.round((count / totalProcesses) * 1000) / 10 : 0;
    const fobBrl = matched.reduce((sum, p) => sum + p.brlFob, 0);
    return { ...meta, count, pct, fobBrl };
  });

  const transitSamples: number[] = [];
  const clearanceSamples: number[] = [];
  const storageSamples: number[] = [];
  const leadTimeSamples: number[] = [];

  const perProcess = processes.slice(0, 12).map((p) => {
    const firstItem = p.items[0];
    const presencaIso = firstItem?.FUP_DATA_PRESENCA_CARGA || '';
    const desIso = firstItem?.DATA_DESEMBARACO || '';
    const clearanceDays =
      presencaIso && desIso ? Math.max(1, daysBetween(presencaIso, desIso)) : 0;

    if (p.transitTime > 0) transitSamples.push(p.transitTime);
    if (clearanceDays > 0) clearanceSamples.push(clearanceDays);
    if (p.days > 0) storageSamples.push(p.days);
    if (p.leadTime > 0) leadTimeSamples.push(p.leadTime);

    const shortRef = p.ref.replace(/^MFX-0*/i, 'MFX-');
    return {
      processRef: p.ref,
      shortRef,
      exporterShort: p.exporter.split(' ')[0] || '-',
      transitDays: p.transitTime,
      clearanceDays,
      storageDays: p.days,
      leadTimeDays: p.leadTime,
      canal: p.canal,
    };
  });

  // Also include remaining processes (> 12) in department averages
  for (let i = 12; i < processes.length; i++) {
    const p = processes[i];
    const firstItem = p.items[0];
    const presencaIso = firstItem?.FUP_DATA_PRESENCA_CARGA || '';
    const desIso = firstItem?.DATA_DESEMBARACO || '';
    const clearanceDays =
      presencaIso && desIso ? Math.max(1, daysBetween(presencaIso, desIso)) : 0;
    if (p.transitTime > 0) transitSamples.push(p.transitTime);
    if (clearanceDays > 0) clearanceSamples.push(clearanceDays);
    if (p.days > 0) storageSamples.push(p.days);
    if (p.leadTime > 0) leadTimeSamples.push(p.leadTime);
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : 0;

  return {
    totalProcesses,
    registeredDiCount,
    channelBreakdown,
    containerAndModal: {
      total20,
      total40,
      totalContainers,
      totalTeus,
      seaCount,
      airCount,
      roadCount,
      demurrageWatchCount,
      modalChartData,
    },
    processPipeline,
    timingMetrics: {
      avgTransitDays: avg(transitSamples),
      avgClearanceDays: avg(clearanceSamples),
      avgStorageDays: avg(storageSamples),
      avgLeadTimeDays: avg(leadTimeSamples),
      perProcess,
    },
  };
}

export function getKraljicStrategy(quadrant: KraljicQuadrant): string {
  switch (quadrant) {
    case 'STRATEGIC':
      return 'Long-term partnership, dual-sourcing qualification, safety stock & Drawback AC lock-in';
    case 'LEVERAGE':
      return 'Competitive bidding, volume consolidation across PEPs, frame agreements & price leverage';
    case 'BOTTLENECK':
      return 'Secure supply continuity, buffer inventory in Plant 0003, expedite customs & qualify backups';
    case 'NON_CRITICAL':
    default:
      return 'Standardize catalog POs, batch replenishment & automate SAP ordering to cut admin cost';
  }
}

export function buildMaterialAnalytics(
  items: FupItemRow[],
  kraljicOverrides: Record<string, KraljicOverride> = {}
): MaterialAnalyticsResult {
  const emptyPqr: Record<PqrClass, { count: number; spendBrl: number; qty: number }> = {
    P: { count: 0, spendBrl: 0, qty: 0 },
    Q: { count: 0, spendBrl: 0, qty: 0 },
    R: { count: 0, spendBrl: 0, qty: 0 },
  };
  const emptyAbc: Record<AbcClass, { count: number; spendBrl: number }> = {
    A: { count: 0, spendBrl: 0 },
    B: { count: 0, spendBrl: 0 },
    C: { count: 0, spendBrl: 0 },
  };
  const emptyQuadrant: Record<
    KraljicQuadrant,
    { count: number; spendBrl: number; spendPct: number }
  > = {
    STRATEGIC: { count: 0, spendBrl: 0, spendPct: 0 },
    LEVERAGE: { count: 0, spendBrl: 0, spendPct: 0 },
    BOTTLENECK: { count: 0, spendBrl: 0, spendPct: 0 },
    NON_CRITICAL: { count: 0, spendBrl: 0, spendPct: 0 },
  };

  if (items.length === 0) {
    return {
      materials: [],
      totalSkus: 0,
      totalSpendBrl: 0,
      totalOrderedQty: 0,
      totalReceivedQty: 0,
      totalStockPlant0003: 0,
      mostBought: null,
      mostUsed: null,
      mostExpensive: null,
      highestUnitCost: null,
      pqrCounts: emptyPqr,
      abcCounts: emptyAbc,
      quadrantSummary: emptyQuadrant,
    };
  }

  const grouped = new Map<string, FupItemRow[]>();
  for (const item of items) {
    const key = item.MATERIAL || item.DESCRICAO_MATERIAL || item.id;
    const list = grouped.get(key) || [];
    list.push(item);
    grouped.set(key, list);
  }

  interface RawAgg {
    materialKey: string;
    materialCode: string;
    descPt: string;
    descEn: string;
    ncm: string;
    unit: string;
    poNumbers: string[];
    poCount: number;
    lineCount: number;
    processRefs: string[];
    suppliers: string[];
    pepProjects: string[];
    totalOrderedQty: number;
    totalReceivedQty: number;
    totalPendingQty: number;
    stockFree: number;
    stockQuality: number;
    stockBlocked: number;
    totalStockPlant0003: number;
    effectiveUsageQty: number;
    utilizationPct: number;
    totalSpendBrl: number;
    totalSpendOrig: number;
    currency: string;
    avgUnitPriceBrl: number;
    maxUnitPriceBrl: number;
    avgDelayDays: number;
    delayedCount: number;
    hasMissingAc: boolean;
    hasRedChannel: boolean;
    hasYellowOrGrayChannel: boolean;
    hasAirUrgency: boolean;
    hasUnshippedOpen: boolean;
    groupItems: FupItemRow[];
  }

  const rawList: RawAgg[] = [];
  let grandTotalSpendBrl = 0;
  let grandTotalOrderedQty = 0;
  let grandTotalReceivedQty = 0;
  let grandTotalStockPlant0003 = 0;
  let totalPoOccurrences = 0;

  for (const [materialKey, groupItems] of grouped.entries()) {
    const primary = groupItems[0];
    const poNumbers = Array.from(new Set(groupItems.map((i) => i.PEDIDO).filter(Boolean)));
    const processRefs = Array.from(
      new Set(groupItems.map((i) => i.ULTIMO_PROCESSO_IMPORTACAO).filter(Boolean))
    );
    const suppliers = Array.from(
      new Set(groupItems.map((i) => i.NOME_FORNECEDOR).filter(Boolean))
    );
    const pepProjects = Array.from(
      new Set(groupItems.map((i) => i.DESCRICAO_ELEMENTO_PEP || i.ELEMENTO_PEP_INTERNO).filter(Boolean))
    );
    const ncmSet = Array.from(
      new Set(
        groupItems
          .flatMap((i) => (i.FUP_NCMS ? i.FUP_NCMS.split(',').map((s) => s.trim()) : []))
          .filter(Boolean)
      )
    );

    const totalOrderedQty = groupItems.reduce((s, i) => s + Math.max(0, i.QUANTIDADE_PEDIDA), 0);
    const totalReceivedQty = groupItems.reduce(
      (s, i) => s + Math.max(0, i.QUANTIDADE_RECEBIDA_LIQUIDA),
      0
    );
    const totalPendingQty = groupItems.reduce(
      (s, i) => s + Math.max(0, i.QUANTIDADE_PENDENTE),
      0
    );

    // Plant stock is a material-level snapshot repeated on PO rows, so take max across rows
    const stockFree = Math.max(...groupItems.map((i) => Math.max(0, i.ESTOQUE_LIVRE_PLANTA_0003)), 0);
    const stockQuality = Math.max(...groupItems.map((i) => Math.max(0, i.ESTOQUE_QUALIDADE_PLANTA_0003)), 0);
    const stockBlocked = Math.max(...groupItems.map((i) => Math.max(0, i.ESTOQUE_BLOQUEADO_PLANTA_0003)), 0);
    const totalStockPlant0003 = Math.max(
      ...groupItems.map((i) => Math.max(0, i.ESTOQUE_SOMA_TRES_CATEGORIAS_PLANTA_0003)),
      stockFree + stockQuality + stockBlocked
    );
    const effectiveUsageQty = Math.max(totalReceivedQty, totalStockPlant0003);
    const utilizationPct =
      totalOrderedQty > 0
        ? Math.min(100, Math.round((effectiveUsageQty / totalOrderedQty) * 1000) / 10)
        : effectiveUsageQty > 0
          ? 100
          : 0;

    let totalSpendBrl = 0;
    let totalSpendOrig = 0;
    let maxUnitPriceBrl = 0;

    for (const row of groupItems) {
      const ptax =
        row.MOEDA === 'BRL'
          ? 1
          : row.MOEDA === 'EUR'
            ? row.FUP_TAXA_EURO_PROCESSO || 6.12
            : row.FUP_TAXA_DOLAR_PROCESSO || 5.65;
      const rowBrl =
        row.FUP_VALOR_FOB_REAIS_PROCESSO > 0
          ? row.FUP_VALOR_FOB_REAIS_PROCESSO
          : row.VALOR_LIQUIDO * ptax;
      totalSpendBrl += rowBrl;
      totalSpendOrig += row.VALOR_LIQUIDO;

      const unitOrig =
        row.PRECO_UNITARIO > 0
          ? row.PRECO_UNITARIO
          : row.QUANTIDADE_PEDIDA > 0
            ? row.VALOR_LIQUIDO / row.QUANTIDADE_PEDIDA
            : row.VALOR_LIQUIDO;
      const unitBrl = unitOrig * ptax;
      if (unitBrl > maxUnitPriceBrl) maxUnitPriceBrl = unitBrl;
    }

    const avgUnitPriceBrl =
      totalOrderedQty > 0 ? totalSpendBrl / totalOrderedQty : maxUnitPriceBrl;

    const delayedRows = groupItems.filter(
      (i) => i.STATUS_PRAZO_ENTREGA === 'ATRASADO' || i.DIAS_ATRASO_ENTREGA > 0
    );
    const avgDelayDays =
      delayedRows.length > 0
        ? Math.round(
            (delayedRows.reduce((s, i) => s + Math.max(0, i.DIAS_ATRASO_ENTREGA), 0) /
              delayedRows.length) *
              10
          ) / 10
        : 0;

    const hasMissingAc = groupItems.some(
      (i) => isDrawbackExpectedNcm(i.FUP_NCMS) && !i.FUP_ATO_CONCESSORIO
    );
    const hasRedChannel = groupItems.some((i) => i.FUP_CANAL_PARAMETRIZACAO === 'VM');
    const hasYellowOrGrayChannel = groupItems.some(
      (i) => i.FUP_CANAL_PARAMETRIZACAO === 'AM' || i.FUP_CANAL_PARAMETRIZACAO === 'CZ'
    );
    const hasAirUrgency = groupItems.some((i) => i.FUP_TIPO_EMBARQUE === 'A');
    const hasUnshippedOpen = groupItems.some(
      (i) => i.QUANTIDADE_PENDENTE > 0 && !i.ULTIMO_PROCESSO_IMPORTACAO
    );

    const poCount = Math.max(poNumbers.length, 1);
    grandTotalSpendBrl += totalSpendBrl;
    grandTotalOrderedQty += totalOrderedQty;
    grandTotalReceivedQty += totalReceivedQty;
    grandTotalStockPlant0003 += totalStockPlant0003;
    totalPoOccurrences += poCount;

    rawList.push({
      materialKey,
      materialCode: primary.MATERIAL || '-',
      descPt: primary.DESCRICAO_MATERIAL || primary.DESCRICAO_MATERIAL_INGLES || '-',
      descEn: primary.DESCRICAO_MATERIAL_INGLES || '-',
      ncm: ncmSet.join(', ') || 'SEM NCM',
      unit: primary.UNIDADE || 'UND',
      poNumbers,
      poCount,
      lineCount: groupItems.length,
      processRefs,
      suppliers,
      pepProjects,
      totalOrderedQty,
      totalReceivedQty,
      totalPendingQty,
      stockFree,
      stockQuality,
      stockBlocked,
      totalStockPlant0003,
      effectiveUsageQty,
      utilizationPct,
      totalSpendBrl,
      totalSpendOrig,
      currency: primary.MOEDA || 'USD',
      avgUnitPriceBrl,
      maxUnitPriceBrl,
      avgDelayDays,
      delayedCount: delayedRows.length,
      hasMissingAc,
      hasRedChannel,
      hasYellowOrGrayChannel,
      hasAirUrgency,
      hasUnshippedOpen,
      groupItems,
    });
  }

  // 1. ABC Spend Classification
  const sortedBySpend = [...rawList].sort((a, b) => b.totalSpendBrl - a.totalSpendBrl);
  const abcMap = new Map<
    string,
    { abcClass: AbcClass; spendSharePct: number; cumulativeSpendPct: number }
  >();
  let cumSpend = 0;
  sortedBySpend.forEach((m, idx) => {
    const share = grandTotalSpendBrl > 0 ? (m.totalSpendBrl / grandTotalSpendBrl) * 100 : 100 / rawList.length;
    const prevCum = cumSpend;
    cumSpend += share;
    const abcClass: AbcClass =
      idx === 0 || prevCum < 80 ? 'A' : prevCum < 95 ? 'B' : 'C';
    abcMap.set(m.materialKey, {
      abcClass,
      spendSharePct: Math.round(share * 10) / 10,
      cumulativeSpendPct: Math.min(100, Math.round(cumSpend * 10) / 10),
    });
  });

  // 2. PQR Demand Velocity & Volume Classification
  const demandScoreOf = (m: RawAgg) => {
    const poShare = totalPoOccurrences > 0 ? (m.poCount / totalPoOccurrences) * 100 : 0;
    const qtyShare = grandTotalOrderedQty > 0 ? (m.totalOrderedQty / grandTotalOrderedQty) * 100 : 0;
    return 0.5 * poShare + 0.5 * qtyShare;
  };
  const sortedByDemand = [...rawList].sort((a, b) => {
    const diff = demandScoreOf(b) - demandScoreOf(a);
    if (Math.abs(diff) > 0.0001) return diff;
    return b.totalSpendBrl - a.totalSpendBrl;
  });
  const pqrMap = new Map<
    string,
    { pqrClass: PqrClass; demandSharePct: number; cumulativeDemandPct: number }
  >();
  let cumDemand = 0;
  sortedByDemand.forEach((m, idx) => {
    const share = demandScoreOf(m);
    const prevCum = cumDemand;
    cumDemand += share;
    const pqrClass: PqrClass =
      idx === 0 || prevCum < 70 ? 'P' : prevCum < 90 ? 'Q' : 'R';
    pqrMap.set(m.materialKey, {
      pqrClass,
      demandSharePct: Math.round(share * 10) / 10,
      cumulativeDemandPct: Math.min(100, Math.round(cumDemand * 10) / 10),
    });
  });

  // 3. Kraljic Scores (Profit Impact 0-100, Supply Risk 0-100)
  const maxMaterialSpendBrl = Math.max(...rawList.map((m) => m.totalSpendBrl), 1);
  const maxOverallUnitBrl = Math.max(...rawList.map((m) => m.maxUnitPriceBrl), 1);

  const materials: MaterialProcurementItem[] = sortedBySpend.map((m) => {
    const abc = abcMap.get(m.materialKey)!;
    const pqr = pqrMap.get(m.materialKey)!;

    const spendComponent = (m.totalSpendBrl / maxMaterialSpendBrl) * 80;
    const unitComponent =
      maxOverallUnitBrl > 0
        ? (Math.log10(1 + m.maxUnitPriceBrl) / Math.log10(1 + maxOverallUnitBrl)) * 20
        : 0;
    const profitImpactScore = Math.min(100, Math.round(spendComponent + unitComponent));

    let supplyRiskScore = 0;
    const riskDrivers: string[] = [];

    if (m.suppliers.length <= 1) {
      supplyRiskScore += 25;
      riskDrivers.push('Single supplier');
    } else if (m.suppliers.length === 2) {
      supplyRiskScore += 12;
      riskDrivers.push('2 suppliers');
    } else {
      supplyRiskScore += 5;
    }

    if (m.avgDelayDays > 10) {
      supplyRiskScore += 25;
      riskDrivers.push(`Avg delay +${m.avgDelayDays}d`);
    } else if (m.avgDelayDays > 0) {
      supplyRiskScore += 15;
      riskDrivers.push(`Avg delay +${m.avgDelayDays}d`);
    }

    const pendingRatio = m.totalOrderedQty > 0 ? m.totalPendingQty / m.totalOrderedQty : 0;
    if (pendingRatio > 0.5) {
      supplyRiskScore += 15;
      riskDrivers.push(`${Math.round(pendingRatio * 100)}% pending delivery`);
    } else if (pendingRatio > 0) {
      supplyRiskScore += 8;
      riskDrivers.push(`${Math.round(pendingRatio * 100)}% pending`);
    }

    if (m.hasMissingAc) {
      supplyRiskScore += 20;
      riskDrivers.push('Missing Drawback AC');
    }

    if (m.hasRedChannel) {
      supplyRiskScore += 15;
      riskDrivers.push('Canal Vermelho');
    } else if (m.hasYellowOrGrayChannel) {
      supplyRiskScore += 8;
      riskDrivers.push('Canal Amarelo/Cinza');
    }

    if (m.hasAirUrgency) {
      supplyRiskScore += 5;
      riskDrivers.push('Air freight modal');
    }

    if (m.hasUnshippedOpen) {
      supplyRiskScore += 10;
      riskDrivers.push('Unshipped open PO');
    }

    supplyRiskScore = Math.min(100, supplyRiskScore);

    const highImpact = profitImpactScore >= 50;
    const highRisk = supplyRiskScore >= 50;
    const computedQuadrant: KraljicQuadrant =
      highImpact && highRisk
        ? 'STRATEGIC'
        : highImpact && !highRisk
          ? 'LEVERAGE'
          : !highImpact && highRisk
            ? 'BOTTLENECK'
            : 'NON_CRITICAL';

    const override = kraljicOverrides[m.materialKey];
    const kraljicQuadrant = override?.quadrant || computedQuadrant;

    emptyPqr[pqr.pqrClass].count += 1;
    emptyPqr[pqr.pqrClass].spendBrl += m.totalSpendBrl;
    emptyPqr[pqr.pqrClass].qty += m.totalOrderedQty;

    emptyAbc[abc.abcClass].count += 1;
    emptyAbc[abc.abcClass].spendBrl += m.totalSpendBrl;

    emptyQuadrant[kraljicQuadrant].count += 1;
    emptyQuadrant[kraljicQuadrant].spendBrl += m.totalSpendBrl;

    return {
      materialKey: m.materialKey,
      materialCode: m.materialCode,
      descPt: m.descPt,
      descEn: m.descEn,
      ncm: m.ncm,
      unit: m.unit,
      poCount: m.poCount,
      lineCount: m.lineCount,
      poNumbers: m.poNumbers,
      processRefs: m.processRefs,
      suppliers: m.suppliers,
      pepProjects: m.pepProjects,
      totalOrderedQty: m.totalOrderedQty,
      totalReceivedQty: m.totalReceivedQty,
      totalPendingQty: m.totalPendingQty,
      stockFree: m.stockFree,
      stockQuality: m.stockQuality,
      stockBlocked: m.stockBlocked,
      totalStockPlant0003: m.totalStockPlant0003,
      effectiveUsageQty: m.effectiveUsageQty,
      utilizationPct: m.utilizationPct,
      avgUnitPriceBrl: m.avgUnitPriceBrl,
      maxUnitPriceBrl: m.maxUnitPriceBrl,
      totalSpendBrl: m.totalSpendBrl,
      totalSpendOrig: m.totalSpendOrig,
      currency: m.currency,
      spendSharePct: abc.spendSharePct,
      cumulativeSpendPct: abc.cumulativeSpendPct,
      demandSharePct: pqr.demandSharePct,
      cumulativeDemandPct: pqr.cumulativeDemandPct,
      pqrClass: pqr.pqrClass,
      abcClass: abc.abcClass,
      profitImpactScore,
      supplyRiskScore,
      riskDrivers,
      computedQuadrant,
      kraljicQuadrant,
      overrideNote: override?.note || '',
      recommendedStrategy: getKraljicStrategy(kraljicQuadrant),
      avgDelayDays: m.avgDelayDays,
      delayedCount: m.delayedCount,
      hasMissingAc: m.hasMissingAc,
      items: m.groupItems,
    };
  });

  for (const qKey of Object.keys(emptyQuadrant) as KraljicQuadrant[]) {
    emptyQuadrant[qKey].spendPct =
      grandTotalSpendBrl > 0
        ? Math.round((emptyQuadrant[qKey].spendBrl / grandTotalSpendBrl) * 1000) / 10
        : 0;
  }

  const mostBought =
    [...materials].sort(
      (a, b) =>
        b.poCount - a.poCount ||
        b.totalOrderedQty - a.totalOrderedQty ||
        b.totalSpendBrl - a.totalSpendBrl
    )[0] || null;

  const mostUsed =
    [...materials].sort(
      (a, b) =>
        b.effectiveUsageQty - a.effectiveUsageQty ||
        b.totalReceivedQty - a.totalReceivedQty ||
        b.totalStockPlant0003 - a.totalStockPlant0003
    )[0] || null;

  const mostExpensive = materials[0] || null; // already sorted by totalSpendBrl desc
  const highestUnitCost =
    [...materials].sort((a, b) => b.maxUnitPriceBrl - a.maxUnitPriceBrl)[0] || null;

  return {
    materials,
    totalSkus: materials.length,
    totalSpendBrl: grandTotalSpendBrl,
    totalOrderedQty: grandTotalOrderedQty,
    totalReceivedQty: grandTotalReceivedQty,
    totalStockPlant0003: grandTotalStockPlant0003,
    mostBought,
    mostUsed,
    mostExpensive,
    highestUnitCost,
    pqrCounts: emptyPqr,
    abcCounts: emptyAbc,
    quadrantSummary: emptyQuadrant,
  };
}

// ---------------------------------------------------------------------------
// Similar Items / Duplicate SAP Material Code Detection
// ---------------------------------------------------------------------------

const MATERIAL_STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'para', 'por', 'com', 'sem', 'em', 'no', 'na',
  'e', 'ou', 'a', 'o', 'as', 'os', 'um', 'uma', 'of', 'for', 'with', 'without',
  'and', 'or', 'the', 'to', 'in', 'on', 'by', 'tipo', 'type', 'modelo', 'model',
  'item', 'peca', 'part',
]);

const CANONICAL_SYNONYMS: Record<string, string> = {
  pol: 'pol',
  polegada: 'pol',
  polegadas: 'pol',
  inch: 'pol',
  inches: 'pol',
  aco: 'aco',
  steel: 'aco',
  inox: 'inox',
  inoxidavel: 'inox',
  stainless: 'inox',
  ss: 'inox',
  conector: 'conector',
  conectores: 'conector',
  connector: 'conector',
  connectors: 'conector',
  engate: 'engate',
  coupling: 'engate',
  rapido: 'rapido',
  quick: 'rapido',
  mangueira: 'mangueira',
  hose: 'mangueira',
  tubo: 'tubo',
  tubos: 'tubo',
  tube: 'tubo',
  pipe: 'tubo',
  valvula: 'valvula',
  valve: 'valvula',
  cabo: 'cabo',
  cable: 'cabo',
  fio: 'fio',
  fios: 'fio',
  yarn: 'fio',
  aramida: 'aramida',
  aramid: 'aramida',
  alta: 'alta',
  high: 'alta',
  pressao: 'pressao',
  pressure: 'pressao',
  flexivel: 'flexivel',
  flexible: 'flexivel',
  corrugado: 'corrugado',
  corrugated: 'corrugado',
  submarino: 'submarino',
  subsea: 'submarino',
  hidraulico: 'hidraulico',
  hydraulic: 'hidraulico',
  termoplastica: 'termoplastica',
  thermoplastic: 'termoplastica',
  pinos: 'pinos',
  pino: 'pinos',
  pin: 'pinos',
  pins: 'pinos',
  und: 'und',
  un: 'und',
  pc: 'und',
  pce: 'und',
  pcs: 'und',
};

export function normalizeMaterialText(raw: string): string {
  if (!raw || raw === '-') return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/["'“”]/g, ' pol ')
    .replace(/(\d+)\s*[x×*]\s*(\d+)/g, '$1x$2')
    .replace(/[-_,.;:()[\]{}+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeMaterialText(raw: string): string[] {
  const norm = normalizeMaterialText(raw);
  if (!norm) return [];
  const rawTokens = norm.split(' ').filter(Boolean);
  const canonical: string[] = [];
  for (const tok of rawTokens) {
    if (MATERIAL_STOPWORDS.has(tok)) continue;
    const mapped = CANONICAL_SYNONYMS[tok] || tok;
    if (mapped.length >= 2 || /\d/.test(mapped)) {
      canonical.push(mapped);
    }
  }
  return Array.from(new Set(canonical));
}

function buildBigrams(str: string): Map<string, number> {
  const clean = str.replace(/\s+/g, '');
  const map = new Map<string, number>();
  if (clean.length < 2) return map;
  for (let i = 0; i < clean.length - 1; i++) {
    const bg = clean.slice(i, i + 2);
    map.set(bg, (map.get(bg) || 0) + 1);
  }
  return map;
}

function diceBigrams(a: Map<string, number>, lenA: number, b: Map<string, number>, lenB: number): number {
  if (lenA === 0 || lenB === 0) return 0;
  let intersection = 0;
  for (const [bg, countA] of a.entries()) {
    const countB = b.get(bg);
    if (countB) intersection += Math.min(countA, countB);
  }
  return (2 * intersection) / (lenA + lenB);
}

function extractSpecTokens(tokens: string[]): string[] {
  return tokens.filter((t) => /\d/.test(t));
}

interface PreparedMaterial {
  item: MaterialProcurementItem;
  normPt: string;
  normEn: string;
  tokensPt: Set<string>;
  tokensCombined: Set<string>;
  specTokens: string[];
  bigramsPt: Map<string, number>;
  bigramLenPt: number;
  bigramsEn: Map<string, number>;
  bigramLenEn: number;
  primaryNcm: string;
  ncmChapter: string;
}

function prepareMaterialForSimilarity(item: MaterialProcurementItem): PreparedMaterial {
  const normPt = normalizeMaterialText(item.descPt);
  const normEn = normalizeMaterialText(item.descEn);
  const ptTokens = tokenizeMaterialText(item.descPt);
  const enTokens = tokenizeMaterialText(item.descEn);
  const combined = Array.from(new Set([...ptTokens, ...enTokens]));
  const bigramsPt = buildBigrams(normPt);
  const bigramsEn = buildBigrams(normEn);
  const sumVals = (m: Map<string, number>) => Array.from(m.values()).reduce((s, v) => s + v, 0);
  const cleanNcm = (item.ncm === 'SEM NCM' ? '' : item.ncm.split(',')[0] || '').replace(/\D/g, '');
  return {
    item,
    normPt,
    normEn,
    tokensPt: new Set(ptTokens),
    tokensCombined: new Set(combined),
    specTokens: extractSpecTokens(combined),
    bigramsPt,
    bigramLenPt: sumVals(bigramsPt),
    bigramsEn,
    bigramLenEn: sumVals(bigramsEn),
    primaryNcm: cleanNcm,
    ncmChapter: cleanNcm.slice(0, 4),
  };
}

export function computePreparedPairSimilarity(
  a: PreparedMaterial,
  b: PreparedMaterial
): { score: number; reasons: string[]; specDifferences: string[]; sharedTokens: string[] } {
  const reasons: string[] = [];
  const specDifferences: string[] = [];

  // Shared canonical tokens
  const sharedTokens: string[] = [];
  for (const t of a.tokensCombined) {
    if (b.tokensCombined.has(t)) sharedTokens.push(t);
  }

  const samePrimaryNcm = Boolean(a.primaryNcm && b.primaryNcm && a.primaryNcm === b.primaryNcm);
  const sameNcmChapter = Boolean(!samePrimaryNcm && a.ncmChapter && b.ncmChapter && a.ncmChapter === b.ncmChapter);
  const sameUnit = Boolean(a.item.unit && b.item.unit && a.item.unit === b.item.unit);
  const sharedSupplier = a.item.suppliers.some((s) => b.item.suppliers.includes(s));

  // 1. Exact normalized PT or EN description match
  const exactPt = Boolean(a.normPt && a.normPt === b.normPt);
  const exactEn = Boolean(a.normEn && a.normEn === b.normEn);
  if (exactPt || exactEn) {
    if (exactPt) reasons.push('Exact PT description match');
    if (exactEn) reasons.push('Exact EN description match');
    if (samePrimaryNcm) reasons.push(`Same NCM ${a.primaryNcm}`);
    if (sameUnit) reasons.push(`Same unit (${a.item.unit})`);
    else reasons.push(`Different units (${a.item.unit} vs ${b.item.unit})`);
    if (sharedSupplier) reasons.push('Shared supplier');
    const score = sameUnit ? 100 : 95;
    return { score, reasons, specDifferences, sharedTokens };
  }

  // 2. Token Jaccard similarity (PT+EN canonicalized)
  const unionSize = a.tokensCombined.size + b.tokensCombined.size - sharedTokens.length;
  const jaccard = unionSize > 0 ? sharedTokens.length / unionSize : 0;

  // 3. Character bigram similarity (best of PT-PT and EN-EN)
  const dicePt = diceBigrams(a.bigramsPt, a.bigramLenPt, b.bigramsPt, b.bigramLenPt);
  const diceEn =
    a.bigramLenEn > 0 && b.bigramLenEn > 0
      ? diceBigrams(a.bigramsEn, a.bigramLenEn, b.bigramsEn, b.bigramLenEn)
      : 0;
  const bestDice = Math.max(dicePt, diceEn);

  // 4. Structural Comex bonus (up to +20)
  let structuralBonus = 0;
  if (samePrimaryNcm) {
    structuralBonus += 10;
    reasons.push(`Same NCM ${a.primaryNcm}`);
  } else if (sameNcmChapter) {
    structuralBonus += 4;
    reasons.push(`Same NCM chapter ${a.ncmChapter}`);
  }
  if (sameUnit) {
    structuralBonus += 5;
    reasons.push(`Same unit (${a.item.unit})`);
  }
  if (sharedSupplier) {
    structuralBonus += 5;
    reasons.push('Shared supplier');
  }

  // 5. Spec/dimension conflict check (e.g. 10k vs 15k, dn25 vs dn50)
  const specSetA = new Set(a.specTokens);
  const specSetB = new Set(b.specTokens);
  const onlyA = a.specTokens.filter((t) => !specSetB.has(t));
  const onlyB = b.specTokens.filter((t) => !specSetA.has(t));
  let specPenalty = 0;
  if (onlyA.length > 0 && onlyB.length > 0) {
    specPenalty = 14;
    specDifferences.push(`${onlyA.slice(0, 2).join('/')} vs ${onlyB.slice(0, 2).join('/')}`);
  }

  // Weighted similarity
  const textWeighted = jaccard * 52 + bestDice * 38;
  const rawScore = Math.round(textWeighted + structuralBonus - specPenalty);
  const score = Math.max(0, Math.min(99, rawScore));

  if (sharedTokens.length > 0) {
    const labelTokens = sharedTokens
      .slice(0, 4)
      .map((t) => t.toUpperCase())
      .join(', ');
    reasons.unshift(`Shared: ${labelTokens}`);
  }
  if (bestDice >= 0.72) {
    reasons.push(`${Math.round(bestDice * 100)}% string match`);
  }

  return { score, reasons, specDifferences, sharedTokens };
}

export function detectSimilarMaterials(
  materials: MaterialProcurementItem[],
  decisions: Record<string, SimilarGroupDecision> = {},
  minScore = 55
): SimilarItemsAnalysisResult {
  const validMaterials = materials.filter(
    (m) => m.materialCode && m.materialCode !== '-'
  );

  if (validMaterials.length < 2) {
    return {
      groups: [],
      totalGroups: 0,
      totalMaterialsInvolved: 0,
      exactDuplicateGroups: 0,
      highSimilarityGroups: 0,
      confirmedDuplicateGroups: 0,
      pendingGroups: 0,
      totalCombinedSpendBrl: 0,
      maxPriceSpreadPct: 0,
    };
  }

  const prepared = validMaterials.map(prepareMaterialForSimilarity);
  const n = prepared.length;

  // Candidate pair generation: full pairwise up to 500 SKUs, inverted token/NCM index above 500
  const candidatePairs: Array<[number, number]> = [];
  if (n <= 500) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (prepared[i].item.materialCode !== prepared[j].item.materialCode) {
          candidatePairs.push([i, j]);
        }
      }
    }
  } else {
    const inverted = new Map<string, number[]>();
    const addBucket = (key: string, idx: number) => {
      const list = inverted.get(key) || [];
      list.push(idx);
      inverted.set(key, list);
    };
    for (let i = 0; i < n; i++) {
      for (const tok of prepared[i].tokensCombined) {
        addBucket(`T:${tok}`, i);
      }
      if (prepared[i].primaryNcm) {
        addBucket(`N:${prepared[i].primaryNcm}`, i);
      }
    }
    const seenPair = new Set<string>();
    for (const bucket of inverted.values()) {
      if (bucket.length < 2 || bucket.length > 250) continue;
      for (let aIdx = 0; aIdx < bucket.length; aIdx++) {
        for (let bIdx = aIdx + 1; bIdx < bucket.length; bIdx++) {
          const i = Math.min(bucket[aIdx], bucket[bIdx]);
          const j = Math.max(bucket[aIdx], bucket[bIdx]);
          if (prepared[i].item.materialCode === prepared[j].item.materialCode) continue;
          const key = `${i}:${j}`;
          if (!seenPair.has(key)) {
            seenPair.add(key);
            candidatePairs.push([i, j]);
          }
        }
      }
    }
  }

  // Disjoint set (Union-Find) for clustering connected similar material codes
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    let curr = x;
    while (parent[curr] !== curr) {
      parent[curr] = parent[parent[curr]];
      curr = parent[curr];
    }
    return curr;
  };
  const unite = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  interface MatchedEdge {
    i: number;
    j: number;
    evidence: SimilarPairEvidence;
    sharedTokens: string[];
  }
  const matchedEdges: MatchedEdge[] = [];

  for (const [i, j] of candidatePairs) {
    const sim = computePreparedPairSimilarity(prepared[i], prepared[j]);
    if (sim.score >= minScore) {
      unite(i, j);
      matchedEdges.push({
        i,
        j,
        evidence: {
          codeA: prepared[i].item.materialCode,
          codeB: prepared[j].item.materialCode,
          score: sim.score,
          reasons: sim.reasons,
          specDifferences: sim.specDifferences,
        },
        sharedTokens: sim.sharedTokens,
      });
    }
  }

  if (matchedEdges.length === 0) {
    return {
      groups: [],
      totalGroups: 0,
      totalMaterialsInvolved: 0,
      exactDuplicateGroups: 0,
      highSimilarityGroups: 0,
      confirmedDuplicateGroups: 0,
      pendingGroups: 0,
      totalCombinedSpendBrl: 0,
      maxPriceSpreadPct: 0,
    };
  }

  const clusterMembers = new Map<number, number[]>();
  const touchedNodes = new Set<number>();
  for (const e of matchedEdges) {
    touchedNodes.add(e.i);
    touchedNodes.add(e.j);
  }
  for (const idx of touchedNodes) {
    const root = find(idx);
    const list = clusterMembers.get(root) || [];
    list.push(idx);
    clusterMembers.set(root, list);
  }

  const edgesByRoot = new Map<number, MatchedEdge[]>();
  for (const e of matchedEdges) {
    const root = find(e.i);
    const list = edgesByRoot.get(root) || [];
    list.push(e);
    edgesByRoot.set(root, list);
  }

  const groups: SimilarMaterialGroup[] = [];
  for (const [root, memberIndices] of clusterMembers.entries()) {
    const groupMaterials = memberIndices
      .map((idx) => prepared[idx].item)
      .sort((a, b) => b.totalSpendBrl - a.totalSpendBrl || a.materialCode.localeCompare(b.materialCode));
    if (groupMaterials.length < 2) continue;

    const groupId = [...groupMaterials]
      .map((m) => m.materialCode)
      .sort()
      .join('|');
    const edges = edgesByRoot.get(root) || [];
    const maxSimilarity = Math.max(...edges.map((e) => e.evidence.score), 0);
    const avgSimilarity =
      edges.length > 0
        ? Math.round(edges.reduce((s, e) => s + e.evidence.score, 0) / edges.length)
        : maxSimilarity;

    const tier: SimilarMatchTier =
      maxSimilarity >= 85
        ? 'EXACT_DUPLICATE'
        : maxSimilarity >= 65
          ? 'HIGH_SIMILARITY'
          : 'POSSIBLE_VARIANT';

    const matchReasons = Array.from(
      new Set(edges.flatMap((e) => e.evidence.reasons))
    ).slice(0, 5);
    const specDifferences = Array.from(
      new Set(edges.flatMap((e) => e.evidence.specDifferences))
    );
    const sharedTokens = Array.from(
      new Set(edges.flatMap((e) => e.sharedTokens))
    );

    const combinedSpendBrl = groupMaterials.reduce((s, m) => s + m.totalSpendBrl, 0);
    const combinedOrderedQty = groupMaterials.reduce((s, m) => s + m.totalOrderedQty, 0);
    const combinedStockPlant0003 = groupMaterials.reduce((s, m) => s + m.totalStockPlant0003, 0);

    const positiveUnitPrices = groupMaterials
      .map((m) => m.avgUnitPriceBrl)
      .filter((p) => p > 0);
    const minUnitPriceBrl = positiveUnitPrices.length > 0 ? Math.min(...positiveUnitPrices) : 0;
    const maxUnitPriceBrl = positiveUnitPrices.length > 0 ? Math.max(...positiveUnitPrices) : 0;
    const unitPriceSpreadPct =
      minUnitPriceBrl > 0
        ? Math.round(((maxUnitPriceBrl - minUnitPriceBrl) / minUnitPriceBrl) * 1000) / 10
        : 0;

    const ncms = new Set(groupMaterials.map((m) => m.ncm).filter((nVal) => nVal && nVal !== 'SEM NCM'));
    const units = new Set(groupMaterials.map((m) => m.unit).filter(Boolean));

    const decision = decisions[groupId];
    const auditStatus = decision?.status || 'PENDING';
    const auditNote = decision?.note || '';
    const primaryMaterialCode =
      decision?.primaryMaterialCode || groupMaterials[0].materialCode;

    groups.push({
      groupId,
      anchorTitle: groupMaterials[0].descPt,
      tier,
      maxSimilarity,
      avgSimilarity,
      matchReasons,
      specDifferences,
      sharedTokens,
      materials: groupMaterials,
      pairEvidences: edges.map((e) => e.evidence),
      combinedSpendBrl,
      combinedOrderedQty,
      combinedStockPlant0003,
      minUnitPriceBrl,
      maxUnitPriceBrl,
      unitPriceSpreadPct,
      sameNcm: ncms.size <= 1 && ncms.size > 0,
      sameUnit: units.size <= 1,
      auditStatus,
      auditNote,
      primaryMaterialCode,
    });
  }

  groups.sort(
    (a, b) =>
      b.maxSimilarity - a.maxSimilarity ||
      b.combinedSpendBrl - a.combinedSpendBrl
  );

  const uniqueMaterialCodes = new Set(
    groups.flatMap((g) => g.materials.map((m) => m.materialCode))
  );

  return {
    groups,
    totalGroups: groups.length,
    totalMaterialsInvolved: uniqueMaterialCodes.size,
    exactDuplicateGroups: groups.filter((g) => g.tier === 'EXACT_DUPLICATE').length,
    highSimilarityGroups: groups.filter((g) => g.tier === 'HIGH_SIMILARITY').length,
    confirmedDuplicateGroups: groups.filter((g) => g.auditStatus === 'CONFIRMED_DUPLICATE').length,
    pendingGroups: groups.filter((g) => g.auditStatus === 'PENDING').length,
    totalCombinedSpendBrl: groups.reduce((s, g) => s + g.combinedSpendBrl, 0),
    maxPriceSpreadPct:
      groups.length > 0
        ? Math.max(...groups.map((g) => g.unitPriceSpreadPct))
        : 0,
  };
}

export interface NcmTaxRateProfile {
  ii: number;
  ipi: number;
  pis: number;
  cofins: number;
  icms: number;
}

const NCM_TAX_PROFILES: Array<{ prefix: string; rates: NcmTaxRateProfile }> = [
  { prefix: '8481', rates: { ii: 12.6, ipi: 5.0, pis: 2.1, cofins: 9.65, icms: 18.0 } },
  { prefix: '8447', rates: { ii: 12.6, ipi: 0.0, pis: 2.1, cofins: 9.65, icms: 18.0 } },
  { prefix: '8535', rates: { ii: 12.0, ipi: 5.0, pis: 2.1, cofins: 9.65, icms: 18.0 } },
  { prefix: '8536', rates: { ii: 14.0, ipi: 5.0, pis: 2.1, cofins: 9.65, icms: 18.0 } },
  { prefix: '8544', rates: { ii: 14.4, ipi: 5.0, pis: 2.1, cofins: 9.65, icms: 18.0 } },
  { prefix: '7304', rates: { ii: 12.0, ipi: 5.0, pis: 2.1, cofins: 9.65, icms: 18.0 } },
  { prefix: '7306', rates: { ii: 12.0, ipi: 5.0, pis: 2.1, cofins: 9.65, icms: 18.0 } },
  { prefix: '7307', rates: { ii: 14.4, ipi: 5.0, pis: 2.1, cofins: 9.65, icms: 18.0 } },
  { prefix: '3917', rates: { ii: 14.0, ipi: 5.0, pis: 2.1, cofins: 9.65, icms: 18.0 } },
  { prefix: '5402', rates: { ii: 16.0, ipi: 0.0, pis: 2.1, cofins: 9.65, icms: 18.0 } },
];

export function resolveDefaultNcmTaxRates(ncm: string): NcmTaxRateProfile {
  const digits = (ncm || '').replace(/\D/g, '');
  const matched = NCM_TAX_PROFILES.find((p) => digits.startsWith(p.prefix));
  return matched ? { ...matched.rates } : { ii: 12.0, ipi: 5.0, pis: 2.1, cofins: 9.65, icms: 18.0 };
}

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

export function calculateBrazilianImportTaxes(params: {
  valorAduaneiroBrl: number;
  iiRatePct: number;
  ipiRatePct: number;
  pisRatePct: number;
  cofinsRatePct: number;
  icmsRatePct: number;
  siscomexBrl: number;
  afrmmBrl?: number;
}): {
  iiBrl: number;
  ipiBrl: number;
  pisBrl: number;
  cofinsBrl: number;
  icmsBrl: number;
  siscomexBrl: number;
  afrmmBrl: number;
  totalTaxesBrl: number;
} {
  const va = Math.max(0, params.valorAduaneiroBrl);
  const iiBrl = round2(va * (Math.max(0, params.iiRatePct) / 100));
  const ipiBrl = round2((va + iiBrl) * (Math.max(0, params.ipiRatePct) / 100));
  const pisBrl = round2(va * (Math.max(0, params.pisRatePct) / 100));
  const cofinsBrl = round2(va * (Math.max(0, params.cofinsRatePct) / 100));
  const siscomexBrl = round2(Math.max(0, params.siscomexBrl));
  const afrmmBrl = round2(Math.max(0, params.afrmmBrl || 0));

  const icmsDec = Math.min(0.4, Math.max(0, params.icmsRatePct) / 100);
  const icmsBase =
    icmsDec > 0 ? (va + iiBrl + ipiBrl + pisBrl + cofinsBrl + siscomexBrl) / (1 - icmsDec) : 0;
  const icmsBrl = icmsDec > 0 ? round2(icmsBase * icmsDec) : 0;

  return {
    iiBrl,
    ipiBrl,
    pisBrl,
    cofinsBrl,
    icmsBrl,
    siscomexBrl,
    afrmmBrl,
    totalTaxesBrl: round2(iiBrl + ipiBrl + pisBrl + cofinsBrl + icmsBrl + siscomexBrl + afrmmBrl),
  };
}

export function buildNumerarioAnalysis(
  items: FupItemRow[],
  processes: ShipmentProcessRow[],
  overridesMap: Record<string, NumerarioOverride> = {},
  includeOpenPos = false
): NumerarioAnalysisResult {
  const rows: NumerarioCostLine[] = [];
  const activeItems = items.filter(
    (i) => i.LOEKZ !== 'L' && i.STATUS_PRAZO_ENTREGA !== 'ITEM EXCLUIDO'
  );

  const computeRowFromGroup = (params: {
    id: string;
    kind: 'SHIPMENT' | 'OPEN_PO';
    processRef: string;
    poList: string;
    diNum: string;
    dataDi: string;
    etaOrDelivery: string;
    supplier: string;
    pepProject: string;
    ncms: string;
    acNumber: string;
    modal: string;
    incoterm: string;
    currency: string;
    ptax: number;
    fobOrig: number;
    fobBrl: number;
    freteFiscalBrl: number;
    seguroFiscalBrl: number;
    valorAduaneiroBrl: number;
    armazenagemBrl: number;
    capataziaBrl: number;
    brokerFeeBrl: number;
    liFeeBrl: number;
    ecotaxBrl: number;
    freteNacionalBrl: number;
    demurrageBrl: number;
    valorAdiantadoBrl: number;
    numerarioRequestDate: string;
    groupItems: FupItemRow[];
  }): NumerarioCostLine => {
    const ov = overridesMap[params.id];
    const hasOverride = Boolean(ov && Object.keys(ov).length > 0);

    const sapIi = round2(params.groupItems.reduce((s, i) => s + i.FUP_TOTAL_II_ITEM, 0));
    const sapIpi = round2(params.groupItems.reduce((s, i) => s + i.FUP_TOTAL_IPI_ITEM, 0));
    const sapPis = round2(params.groupItems.reduce((s, i) => s + i.FUP_TOTAL_PIS_ITEM, 0));
    const sapCofins = round2(params.groupItems.reduce((s, i) => s + i.FUP_TOTAL_COFINS_ITEM, 0));
    const sapIcms = round2(params.groupItems.reduce((s, i) => s + i.FUP_TOTAL_ICMS_ITEM, 0));
    const sapSiscomex = round2(params.groupItems.reduce((s, i) => s + i.FUP_TOTAL_SISCOMEX_ITEM, 0));
    const sapAfrmm = round2(Math.max(...params.groupItems.map((i) => i.FUP_AFRMM_PROCESSO), 0));

    const hasCustomRates =
      ov?.iiRatePct !== undefined ||
      ov?.ipiRatePct !== undefined ||
      ov?.pisRatePct !== undefined ||
      ov?.cofinsRatePct !== undefined ||
      ov?.icmsRatePct !== undefined ||
      ov?.siscomexBrl !== undefined;

    const hasRecordedDi =
      (params.diNum && params.diNum !== '-') ||
      (params.dataDi && params.dataDi !== '-') ||
      params.groupItems.some(
        (i) =>
          i.FUP_QUANTIDADE_DI > 0 ||
          i.FUP_VALOR_ADUANEIRO > 0 ||
          i.detalhesFiscais.length > 0
      ) ||
      sapIi + sapIpi + sapPis + sapCofins + sapIcms + sapSiscomex > 0;

    const hasAc = Boolean(params.acNumber && params.acNumber !== '-');
    const isAwaitingAc =
      !hasAc &&
      params.groupItems.some(
        (i) =>
          isDrawbackExpectedNcm(i.FUP_NCMS) ||
          (i.detalhesFiscais[0]?.REGIME_TRIBUTARIO || '').toUpperCase().includes('AGUARDANDO')
      );

    let taxRegime: NumerarioTaxRegime;
    if (ov?.regimeOverride === 'DRAWBACK_SUSP') {
      taxRegime = 'DRAWBACK_SUSP';
    } else if (ov?.regimeOverride === 'RECOLHIMENTO_INTEGRAL') {
      taxRegime = 'RECOLHIMENTO_INTEGRAL';
    } else if (hasAc) {
      taxRegime = 'DRAWBACK_SUSP';
    } else if (isAwaitingAc) {
      taxRegime = 'AGUARDANDO_AC';
    } else {
      taxRegime = 'RECOLHIMENTO_INTEGRAL';
    }

    const vaBase = params.valorAduaneiroBrl > 0 ? params.valorAduaneiroBrl : 0;
    const calcEffectiveRate = (taxBrl: number, baseBrl: number) =>
      baseBrl > 0 && taxBrl > 0 ? round2((taxBrl / baseBrl) * 100) : 0;

    let sourceType: NumerarioSourceType;
    let iiBrl = 0;
    let ipiBrl = 0;
    let pisBrl = 0;
    let cofinsBrl = 0;
    let icmsBrl = 0;
    let siscomexBrl = 0;
    let afrmmBrl = 0;
    let effIiRate = 0;
    let effIpiRate = 0;
    let effPisRate = 0;
    let effCofinsRate = 0;
    let effIcmsRate = 0;
    let potentialDrawbackSavingsBrl = 0;

    if (hasCustomRates) {
      const simIiRate = ov?.iiRatePct ?? calcEffectiveRate(sapIi, vaBase);
      const simIpiRate = ov?.ipiRatePct ?? calcEffectiveRate(sapIpi, vaBase + sapIi);
      const simPisRate = ov?.pisRatePct ?? calcEffectiveRate(sapPis, vaBase);
      const simCofinsRate = ov?.cofinsRatePct ?? calcEffectiveRate(sapCofins, vaBase);
      const simIcmsRate =
        ov?.icmsRatePct ??
        calcEffectiveRate(
          sapIcms,
          vaBase + sapIi + sapIpi + sapPis + sapCofins + sapSiscomex + sapIcms
        );
      const simSiscomex = ov?.siscomexBrl ?? sapSiscomex;

      const simCalc = calculateBrazilianImportTaxes({
        valorAduaneiroBrl: params.valorAduaneiroBrl,
        iiRatePct: simIiRate,
        ipiRatePct: simIpiRate,
        pisRatePct: simPisRate,
        cofinsRatePct: simCofinsRate,
        icmsRatePct: simIcmsRate,
        siscomexBrl: simSiscomex,
        afrmmBrl: sapAfrmm,
      });

      if (taxRegime === 'DRAWBACK_SUSP') {
        sourceType = 'DRAWBACK_SUSPENDED';
        siscomexBrl = round2(simSiscomex);
        afrmmBrl = 0;
        potentialDrawbackSavingsBrl = round2(
          simCalc.iiBrl + simCalc.ipiBrl + simCalc.pisBrl + simCalc.cofinsBrl + simCalc.icmsBrl
        );
      } else {
        sourceType = 'SIMULATED';
        iiBrl = simCalc.iiBrl;
        ipiBrl = simCalc.ipiBrl;
        pisBrl = simCalc.pisBrl;
        cofinsBrl = simCalc.cofinsBrl;
        icmsBrl = simCalc.icmsBrl;
        siscomexBrl = simCalc.siscomexBrl;
        afrmmBrl = simCalc.afrmmBrl;
        effIiRate = round2(simIiRate);
        effIpiRate = round2(simIpiRate);
        effPisRate = round2(simPisRate);
        effCofinsRate = round2(simCofinsRate);
        effIcmsRate = round2(simIcmsRate);
        if (taxRegime === 'AGUARDANDO_AC') {
          potentialDrawbackSavingsBrl = round2(iiBrl + ipiBrl + pisBrl + cofinsBrl + icmsBrl);
        }
      }
    } else if (taxRegime === 'DRAWBACK_SUSP') {
      sourceType = 'DRAWBACK_SUSPENDED';
      if (ov?.regimeOverride === 'DRAWBACK_SUSP') {
        iiBrl = 0;
        ipiBrl = 0;
        pisBrl = 0;
        cofinsBrl = 0;
        icmsBrl = 0;
        siscomexBrl = sapSiscomex;
        afrmmBrl = 0;
      } else {
        iiBrl = sapIi;
        ipiBrl = sapIpi;
        pisBrl = sapPis;
        cofinsBrl = sapCofins;
        icmsBrl = sapIcms;
        siscomexBrl = sapSiscomex;
        afrmmBrl = sapAfrmm;
      }
      effIiRate = calcEffectiveRate(iiBrl, vaBase);
      effIpiRate = calcEffectiveRate(ipiBrl, vaBase + iiBrl);
      effPisRate = calcEffectiveRate(pisBrl, vaBase);
      effCofinsRate = calcEffectiveRate(cofinsBrl, vaBase);
      effIcmsRate = calcEffectiveRate(
        icmsBrl,
        vaBase + iiBrl + ipiBrl + pisBrl + cofinsBrl + siscomexBrl + icmsBrl
      );
    } else {
      // Strictly follow uploaded SAP / Excel values (never guess taxes when Excel has 0)
      sourceType = hasRecordedDi ? 'SAP_DI' : 'PRE_DI_SAP';
      iiBrl = sapIi;
      ipiBrl = sapIpi;
      pisBrl = sapPis;
      cofinsBrl = sapCofins;
      icmsBrl = sapIcms;
      siscomexBrl = sapSiscomex;
      afrmmBrl = sapAfrmm;
      effIiRate = calcEffectiveRate(iiBrl, vaBase);
      effIpiRate = calcEffectiveRate(ipiBrl, vaBase + iiBrl);
      effPisRate = calcEffectiveRate(pisBrl, vaBase);
      effCofinsRate = calcEffectiveRate(cofinsBrl, vaBase);
      effIcmsRate = calcEffectiveRate(
        icmsBrl,
        vaBase + iiBrl + ipiBrl + pisBrl + cofinsBrl + siscomexBrl + icmsBrl
      );
      if (taxRegime === 'AGUARDANDO_AC') {
        potentialDrawbackSavingsBrl = round2(iiBrl + ipiBrl + pisBrl + cofinsBrl + icmsBrl);
      }
    }

    const totalTaxesBrl = round2(
      iiBrl + ipiBrl + pisBrl + cofinsBrl + icmsBrl + siscomexBrl + afrmmBrl
    );

    const totalClearanceExpensesBrl = round2(
      params.armazenagemBrl +
        params.capataziaBrl +
        params.brokerFeeBrl +
        params.liFeeBrl +
        params.ecotaxBrl +
        params.freteNacionalBrl +
        params.demurrageBrl
    );

    const totalNumerarioBrl = round2(totalTaxesBrl + totalClearanceExpensesBrl);
    const valorAdiantadoBrl = round2(ov?.valorAdtOverride ?? params.valorAdiantadoBrl);
    const saldoFinanceiroBrl = round2(totalNumerarioBrl - valorAdiantadoBrl);
    const numerarioRequestDate = ov?.numerarioDateOverride ?? params.numerarioRequestDate;

    const defaultFinanceStatus: NumerarioFinanceStatus =
      params.diNum !== '-' &&
      params.groupItems.some((i) => Boolean(i.DATA_DESEMBARACO)) &&
      saldoFinanceiroBrl <= 0
        ? 'PAID'
        : valorAdiantadoBrl > 0
          ? 'REQUESTED'
          : 'DRAFT';

    return {
      id: params.id,
      kind: params.kind,
      processRef: params.processRef,
      poList: params.poList,
      diNum: params.diNum,
      dataDi: params.dataDi,
      etaOrDelivery: params.etaOrDelivery,
      supplier: params.supplier,
      pepProject: params.pepProject,
      ncms: params.ncms,
      acNumber: params.acNumber,
      modal: params.modal,
      incoterm: params.incoterm,
      currency: params.currency,
      ptax: params.ptax,
      fobOrig: round2(params.fobOrig),
      fobBrl: round2(params.fobBrl),
      freteFiscalBrl: round2(params.freteFiscalBrl),
      seguroFiscalBrl: round2(params.seguroFiscalBrl),
      valorAduaneiroBrl: round2(params.valorAduaneiroBrl),
      sourceType,
      taxRegime,
      iiBrl,
      ipiBrl,
      pisBrl,
      cofinsBrl,
      icmsBrl,
      siscomexBrl,
      afrmmBrl,
      totalTaxesBrl,
      iiRatePct: effIiRate,
      ipiRatePct: effIpiRate,
      pisRatePct: effPisRate,
      cofinsRatePct: effCofinsRate,
      icmsRatePct: effIcmsRate,
      armazenagemBrl: round2(params.armazenagemBrl),
      capataziaBrl: round2(params.capataziaBrl),
      brokerFeeBrl: round2(params.brokerFeeBrl),
      liFeeBrl: round2(params.liFeeBrl),
      ecotaxBrl: round2(params.ecotaxBrl),
      freteNacionalBrl: round2(params.freteNacionalBrl),
      demurrageBrl: round2(params.demurrageBrl),
      totalClearanceExpensesBrl,
      totalNumerarioBrl,
      potentialDrawbackSavingsBrl,
      valorAdiantadoBrl,
      saldoFinanceiroBrl,
      numerarioRequestDate,
      financeStatus: ov?.financeStatus || defaultFinanceStatus,
      financeNote: ov?.financeNote || '',
      hasOverride,
      items: params.groupItems,
    };
  };

  // 1. Active Shipment Processes (MFX Refs)
  for (const proc of processes) {
    const primary = proc.items[0];
    const ncms = Array.from(
      new Set(proc.items.map((i) => i.FUP_NCMS).filter(Boolean))
    ).join(', ') || 'SEM NCM';
    const freteFiscal = proc.items.reduce((s, i) => s + i.FUP_TOTAL_FRETE_FISCAL_ITEM, 0);
    const seguroFiscal = proc.items.reduce((s, i) => s + i.FUP_TOTAL_SEGURO_FISCAL_ITEM, 0);
    const capatazia = Math.max(...proc.items.map((i) => i.FUP_CAPATAZIA_PROCESSO), 0);

    rows.push(
      computeRowFromGroup({
        id: proc.ref,
        kind: 'SHIPMENT',
        processRef: proc.ref,
        poList: proc.poList,
        diNum: proc.diNum,
        dataDi: formatDateBr(primary?.DATA_DI),
        etaOrDelivery: proc.eta !== '-' ? proc.eta : proc.etaFactory,
        supplier: proc.exporter,
        pepProject: proc.linha,
        ncms,
        acNumber: proc.ac,
        modal: proc.modal,
        incoterm: proc.incoterm,
        currency: proc.currency,
        ptax: proc.ptax,
        fobOrig: proc.invoiceValue,
        fobBrl: proc.brlFob,
        freteFiscalBrl: freteFiscal,
        seguroFiscalBrl: seguroFiscal,
        valorAduaneiroBrl: proc.brlCif,
        armazenagemBrl: proc.armazenagem,
        capataziaBrl: capatazia,
        brokerFeeBrl: proc.brokerFee,
        liFeeBrl: proc.liFee,
        ecotaxBrl: proc.ecotax,
        freteNacionalBrl: proc.trucking,
        demurrageBrl: proc.demurrageTotal,
        valorAdiantadoBrl: proc.valorAdt,
        numerarioRequestDate: proc.numerario,
        groupItems: proc.items,
      })
    );
  }

  // 2. Optional Unshipped Open POs (for Pre-DI financial forecasting)
  if (includeOpenPos) {
    const openPoMap = new Map<string, FupItemRow[]>();
    for (const item of activeItems) {
      if (item.ULTIMO_PROCESSO_IMPORTACAO?.trim() || item.QUANTIDADE_PENDENTE <= 0) continue;
      const list = openPoMap.get(item.PEDIDO) || [];
      list.push(item);
      openPoMap.set(item.PEDIDO, list);
    }

    for (const [po, poItems] of openPoMap.entries()) {
      const primary = poItems[0];
      const currency = primary.MOEDA || 'USD';
      const taxaUsd =
        poItems.find((i) => i.FUP_TAXA_DOLAR_PROCESSO > 0)?.FUP_TAXA_DOLAR_PROCESSO || 5.65;
      const taxaEur =
        poItems.find((i) => i.FUP_TAXA_EURO_PROCESSO > 0)?.FUP_TAXA_EURO_PROCESSO || 6.12;
      const ptax = currency === 'BRL' ? 1 : currency === 'EUR' ? taxaEur : taxaUsd;
      const fobOrig = poItems.reduce((s, i) => {
        const ratio = i.QUANTIDADE_PEDIDA > 0 ? i.QUANTIDADE_PENDENTE / i.QUANTIDADE_PEDIDA : 1;
        return s + i.VALOR_LIQUIDO * ratio;
      }, 0);
      const sapMerc = round2(poItems.reduce((s, i) => s + i.FUP_VALOR_MERCADORIA, 0));
      const sapVa = round2(poItems.reduce((s, i) => s + i.FUP_VALOR_ADUANEIRO, 0));
      const sapFrete = round2(poItems.reduce((s, i) => s + i.FUP_TOTAL_FRETE_FISCAL_ITEM, 0));
      const sapSeguro = round2(poItems.reduce((s, i) => s + i.FUP_TOTAL_SEGURO_FISCAL_ITEM, 0));
      const fobBrl = sapMerc > 0 ? sapMerc : fobOrig * ptax;
      const vaFromSap = sapVa > 0 ? sapVa : round2(fobBrl + sapFrete + sapSeguro);

      const acNumber =
        Array.from(new Set(poItems.map((i) => i.FUP_ATO_CONCESSORIO).filter(Boolean))).join(', ') ||
        '-';
      const ncms =
        Array.from(new Set(poItems.map((i) => i.FUP_NCMS).filter(Boolean))).join(', ') || 'SEM NCM';
      const pepProject =
        Array.from(new Set(poItems.map((i) => i.DESCRICAO_ELEMENTO_PEP).filter(Boolean))).join(' / ') ||
        '-';
      const modal =
        primary.FUP_TIPO_EMBARQUE === 'A'
          ? 'AÉREO'
          : primary.FUP_TIPO_EMBARQUE === 'M'
            ? 'MARÍTIMO'
            : 'RODOVIÁRIO';

      rows.push(
        computeRowFromGroup({
          id: `PO-${po}`,
          kind: 'OPEN_PO',
          processRef: 'Pre-Shipment PO',
          poList: po,
          diNum: '-',
          dataDi: '-',
          etaOrDelivery: formatDateBr(primary.DATA_ENTREGA_PREVISTA),
          supplier: primary.NOME_FORNECEDOR || '-',
          pepProject,
          ncms,
          acNumber,
          modal,
          incoterm: primary.FUP_INCOTERM || '-',
          currency,
          ptax,
          fobOrig,
          fobBrl,
          freteFiscalBrl: sapFrete,
          seguroFiscalBrl: sapSeguro,
          valorAduaneiroBrl: vaFromSap,
          armazenagemBrl: round2(Math.max(...poItems.map((i) => i.FUP_ARMAZENAGEM_PROCESSO), 0)),
          capataziaBrl: round2(Math.max(...poItems.map((i) => i.FUP_CAPATAZIA_PROCESSO), 0)),
          brokerFeeBrl: 0,
          liFeeBrl: 0,
          ecotaxBrl: 0,
          freteNacionalBrl: 0,
          demurrageBrl: 0,
          valorAdiantadoBrl: 0,
          numerarioRequestDate: '-',
          groupItems: poItems,
        })
      );
    }
  }

  // Sort: Pending cash calls / Recolhimento Integral / Aguardando AC first, then by total Numerário
  rows.sort(
    (a, b) =>
      (b.saldoFinanceiroBrl > 0 ? 1 : 0) - (a.saldoFinanceiroBrl > 0 ? 1 : 0) ||
      b.totalNumerarioBrl - a.totalNumerarioBrl ||
      a.id.localeCompare(b.id)
  );

  const totals = {
    valorAduaneiroBrl: round2(rows.reduce((s, r) => s + r.valorAduaneiroBrl, 0)),
    iiBrl: round2(rows.reduce((s, r) => s + r.iiBrl, 0)),
    ipiBrl: round2(rows.reduce((s, r) => s + r.ipiBrl, 0)),
    pisBrl: round2(rows.reduce((s, r) => s + r.pisBrl, 0)),
    cofinsBrl: round2(rows.reduce((s, r) => s + r.cofinsBrl, 0)),
    icmsBrl: round2(rows.reduce((s, r) => s + r.icmsBrl, 0)),
    siscomexBrl: round2(rows.reduce((s, r) => s + r.siscomexBrl, 0)),
    afrmmBrl: round2(rows.reduce((s, r) => s + r.afrmmBrl, 0)),
    totalTaxesBrl: round2(rows.reduce((s, r) => s + r.totalTaxesBrl, 0)),
    totalClearanceExpensesBrl: round2(rows.reduce((s, r) => s + r.totalClearanceExpensesBrl, 0)),
    totalNumerarioBrl: round2(rows.reduce((s, r) => s + r.totalNumerarioBrl, 0)),
    valorAdiantadoBrl: round2(rows.reduce((s, r) => s + r.valorAdiantadoBrl, 0)),
    saldoFinanceiroBrl: round2(rows.reduce((s, r) => s + r.saldoFinanceiroBrl, 0)),
    drawbackSavedBrl: round2(
      rows
        .filter((r) => r.taxRegime === 'DRAWBACK_SUSP')
        .reduce((s, r) => s + r.potentialDrawbackSavingsBrl, 0)
    ),
    drawbackCoveredVaBrl: round2(
      rows
        .filter((r) => r.taxRegime === 'DRAWBACK_SUSP')
        .reduce((s, r) => s + r.valorAduaneiroBrl, 0)
    ),
    potentialSavingsIfAcLinkedBrl: round2(
      rows
        .filter((r) => r.taxRegime === 'AGUARDANDO_AC')
        .reduce((s, r) => s + r.potentialDrawbackSavingsBrl, 0)
    ),
  };

  const taxBreakdownChart = [
    { name: 'ICMS', key: 'icmsBrl', valueBrl: totals.icmsBrl, color: '#8b5cf6' },
    { name: 'II', key: 'iiBrl', valueBrl: totals.iiBrl, color: '#06b6d4' },
    { name: 'COFINS', key: 'cofinsBrl', valueBrl: totals.cofinsBrl, color: '#3b82f6' },
    { name: 'IPI', key: 'ipiBrl', valueBrl: totals.ipiBrl, color: '#f59e0b' },
    { name: 'PIS', key: 'pisBrl', valueBrl: totals.pisBrl, color: '#10b981' },
    {
      name: 'Port & Broker',
      key: 'totalClearanceExpensesBrl',
      valueBrl: totals.totalClearanceExpensesBrl,
      color: '#ec4899',
    },
    {
      name: 'Siscomex/AFRMM',
      key: 'siscomexAfrmm',
      valueBrl: round2(totals.siscomexBrl + totals.afrmmBrl),
      color: '#64748b',
    },
  ];

  return {
    rows,
    totals,
    counts: {
      totalRows: rows.length,
      shipmentRows: rows.filter((r) => r.kind === 'SHIPMENT').length,
      openPoRows: rows.filter((r) => r.kind === 'OPEN_PO').length,
      sapDiCount: rows.filter((r) => r.sourceType === 'SAP_DI').length,
      preDiCount: rows.filter((r) => r.sourceType === 'PRE_DI_SAP').length,
      simulatedCount: rows.filter((r) => r.sourceType === 'SIMULATED').length,
      drawbackSuspCount: rows.filter((r) => r.taxRegime === 'DRAWBACK_SUSP').length,
      pendingCashCallCount: rows.filter((r) => r.saldoFinanceiroBrl > 50).length,
    },
    taxBreakdownChart,
  };
}

export function buildShipmentWorthinessAnalysis(
  processes: ShipmentProcessRow[],
  filteredItems: FupItemRow[],
  allItems: FupItemRow[] = filteredItems
): ShipmentWorthinessAnalysisResult {
  const round2 = (v: number): number =>
    Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
  const pct = (num: number, den: number): number =>
    den > 0 && Number.isFinite(num) ? round2((num / den) * 100) : 0;

  // 1. Cross-order Material Trouble Profiling (across full SAP history, excluding deleted LOEKZ='L')
  const historySource = (allItems.length > 0 ? allItems : filteredItems).filter(
    (i) => i.LOEKZ !== 'L' && i.STATUS_PRAZO_ENTREGA !== 'ITEM EXCLUIDO'
  );

  interface MatAcc {
    materialCode: string;
    descPt: string;
    descEn: string;
    ncm: string;
    suppliers: Map<string, number>;
    poSet: Set<string>;
    latePoSet: Set<string>;
    processes: Set<string>;
    lineCount: number;
    lateLines: number;
    delayDaysList: number[];
    airCount: number;
    seaCount: number;
    exwCount: number;
    missingAcCount: number;
    totalSpendBrl: number;
    totalFreightAndStorageBrl: number;
    totalStorageAndDemurrageBrl: number;
    stockPlant0003: number;
    canalRedOrYellowCount: number;
  }

  const processByRef = new Map<string, ShipmentProcessRow>();
  for (const p of processes) processByRef.set(p.ref, p);

  const matMap = new Map<string, MatAcc>();
  for (const item of historySource) {
    const code = (item.MATERIAL || item.DESCRICAO_MATERIAL || item.id).trim();
    if (!code) continue;

    let acc = matMap.get(code);
    if (!acc) {
      acc = {
        materialCode: code,
        descPt: item.DESCRICAO_MATERIAL || '-',
        descEn: item.DESCRICAO_MATERIAL_INGLES || '-',
        ncm: item.FUP_NCMS || '-',
        suppliers: new Map(),
        poSet: new Set(),
        latePoSet: new Set(),
        processes: new Set(),
        lineCount: 0,
        lateLines: 0,
        delayDaysList: [],
        airCount: 0,
        seaCount: 0,
        exwCount: 0,
        missingAcCount: 0,
        totalSpendBrl: 0,
        totalFreightAndStorageBrl: 0,
        totalStorageAndDemurrageBrl: 0,
        stockPlant0003: item.ESTOQUE_SOMA_TRES_CATEGORIAS_PLANTA_0003 || 0,
        canalRedOrYellowCount: 0,
      };
      matMap.set(code, acc);
    }

    acc.lineCount += 1;
    if (item.PEDIDO) acc.poSet.add(item.PEDIDO);
    if (item.NOME_FORNECEDOR) {
      acc.suppliers.set(
        item.NOME_FORNECEDOR,
        (acc.suppliers.get(item.NOME_FORNECEDOR) || 0) + 1
      );
    }
    if (item.ULTIMO_PROCESSO_IMPORTACAO) {
      acc.processes.add(item.ULTIMO_PROCESSO_IMPORTACAO);
    }
    if (item.ESTOQUE_SOMA_TRES_CATEGORIAS_PLANTA_0003 > acc.stockPlant0003) {
      acc.stockPlant0003 = item.ESTOQUE_SOMA_TRES_CATEGORIAS_PLANTA_0003;
    }

    const isLate =
      item.STATUS_PRAZO_ENTREGA === 'ATRASADO' || item.DIAS_ATRASO_ENTREGA > 0;
    if (isLate) {
      acc.lateLines += 1;
      if (item.PEDIDO) acc.latePoSet.add(item.PEDIDO);
      if (item.DIAS_ATRASO_ENTREGA > 0) acc.delayDaysList.push(item.DIAS_ATRASO_ENTREGA);
    }

    if (item.FUP_TIPO_EMBARQUE === 'A') acc.airCount += 1;
    else if (item.FUP_TIPO_EMBARQUE === 'M') acc.seaCount += 1;

    if ((item.FUP_INCOTERM || '').toUpperCase().startsWith('EXW')) {
      acc.exwCount += 1;
    }

    const hasDrawbackNcm = item.FUP_NCMS
      .split(',')
      .some((n) => isDrawbackExpectedNcm(n.trim()));
    if (hasDrawbackNcm && !item.FUP_ATO_CONCESSORIO) {
      acc.missingAcCount += 1;
    }

    if (
      item.FUP_CANAL_PARAMETRIZACAO === 'VM' ||
      item.FUP_CANAL_PARAMETRIZACAO === 'AM'
    ) {
      acc.canalRedOrYellowCount += 1;
    }

    const fxRate =
      item.MOEDA === 'BRL'
        ? 1
        : item.MOEDA === 'EUR'
          ? item.FUP_TAXA_EURO_PROCESSO || 6.12
          : item.FUP_TAXA_DOLAR_PROCESSO || 5.65;
    const itemFobBrl =
      item.FUP_VALOR_MERCADORIA > 0
        ? item.FUP_VALOR_MERCADORIA
        : item.VALOR_LIQUIDO * fxRate;

    acc.totalSpendBrl += itemFobBrl;
    const linkedProc = item.ULTIMO_PROCESSO_IMPORTACAO
      ? processByRef.get(item.ULTIMO_PROCESSO_IMPORTACAO)
      : undefined;
    const procStorage =
      linkedProc?.armazenagem ?? item.FUP_ARMAZENAGEM_PROCESSO ?? 0;
    const procDemurrage = linkedProc?.demurrageTotal ?? 0;

    // Distribute process-level storage/demurrage safely on single-item or multi-item fallback
    const shareDivisor =
      linkedProc && linkedProc.items.length > 1 ? linkedProc.items.length : 1;
    acc.totalFreightAndStorageBrl +=
      item.FUP_TOTAL_FRETE_FISCAL_ITEM + procStorage / shareDivisor;
    acc.totalStorageAndDemurrageBrl +=
      (procStorage + procDemurrage) / shareDivisor;
  }

  const materialTroubleMap = new Map<string, MaterialTroubleProfile>();
  const materialTroubles: MaterialTroubleProfile[] = [];

  for (const acc of matMap.values()) {
    const orderCount = Math.max(acc.poSet.size, acc.lineCount);
    const lateOrderCount = Math.max(acc.latePoSet.size, acc.lateLines);
    const delayedRatePct = round2((lateOrderCount / orderCount) * 100);
    const avgDelayDays =
      acc.delayDaysList.length > 0
        ? round2(
            acc.delayDaysList.reduce((s, d) => s + d, 0) /
              acc.delayDaysList.length
          )
        : 0;
    const maxDelayDays =
      acc.delayDaysList.length > 0 ? Math.max(...acc.delayDaysList) : 0;

    let primarySupplier = '-';
    let topSupCount = 0;
    for (const [sup, cnt] of acc.suppliers.entries()) {
      if (cnt > topSupCount) {
        topSupCount = cnt;
        primarySupplier = sup;
      }
    }

    const troubleSignals: string[] = [];
    if (lateOrderCount >= 2) {
      troubleSignals.push(`Repeat delays (${lateOrderCount}/${orderCount} POs)`);
    } else if (lateOrderCount === 1 && maxDelayDays >= 7) {
      troubleSignals.push(`Delayed +${maxDelayDays}d vs SLA`);
    } else if (lateOrderCount === 1) {
      troubleSignals.push(`Delayed +${maxDelayDays || 1}d`);
    }
    if (acc.airCount >= 2) {
      troubleSignals.push(`Repeat Air freight (${acc.airCount}x)`);
    } else if (acc.airCount >= 1 && acc.lateLines > 0) {
      troubleSignals.push('Emergency Air + Late delivery');
    }
    if (acc.missingAcCount > 0) {
      troubleSignals.push('Missing Drawback AC');
    }
    if (acc.exwCount > 0) {
      troubleSignals.push('EXW origin cost exposure');
    }
    if (acc.totalStorageAndDemurrageBrl >= 8000) {
      troubleSignals.push('High port storage / demurrage');
    }
    if (acc.canalRedOrYellowCount > 0) {
      troubleSignals.push('Customs Yellow/Red channel');
    }

    const avgCostOverFobPct = pct(acc.totalFreightAndStorageBrl, acc.totalSpendBrl);

    const fixParts: string[] = [];
    if (acc.missingAcCount > 0) {
      fixParts.push('Link Drawback AC at PO creation to avoid customs holds');
    }
    if (lateOrderCount >= 2 || maxDelayDays >= 10) {
      fixParts.push('Enforce Supplier SLA + extend MRP buffer lead time');
    }
    if (acc.airCount >= 2 || (acc.airCount >= 1 && acc.stockPlant0003 > 0)) {
      fixParts.push('Consolidate into scheduled Sea PO / Blanket agreement');
    }
    if (acc.exwCount > 0) {
      fixParts.push('Renegotiate Incoterm EXW → FCA/FOB');
    }
    if (acc.totalStorageAndDemurrageBrl >= 8000) {
      fixParts.push('Pre-file DI & advance Numerário at ETA -5d to clear in Period 1');
    }
    if (fixParts.length === 0) {
      fixParts.push('Maintain current sourcing cadence and customs pre-alert check');
    }

    const severityScore =
      (lateOrderCount >= 2 ? 3 : lateOrderCount >= 1 ? 1 : 0) +
      (acc.missingAcCount > 0 ? 2 : 0) +
      (acc.airCount >= 2 ? 2 : 0) +
      (acc.totalStorageAndDemurrageBrl >= 10000 ? 2 : acc.totalStorageAndDemurrageBrl >= 5000 ? 1 : 0) +
      (maxDelayDays >= 15 ? 2 : 0);

    const severity: MaterialTroubleProfile['severity'] =
      severityScore >= 4 ? 'HIGH' : severityScore >= 2 ? 'MEDIUM' : 'LOW';

    const profile: MaterialTroubleProfile = {
      materialCode: acc.materialCode,
      descPt: acc.descPt,
      descEn: acc.descEn,
      ncm: acc.ncm,
      primarySupplier,
      orderCount,
      lineCount: acc.lineCount,
      lateOrderCount,
      delayedRatePct,
      avgDelayDays,
      maxDelayDays,
      airShipmentCount: acc.airCount,
      seaShipmentCount: acc.seaCount,
      exwOrderCount: acc.exwCount,
      missingAcCount: acc.missingAcCount,
      totalSpendBrl: round2(acc.totalSpendBrl),
      totalFreightAndStorageBrl: round2(acc.totalFreightAndStorageBrl),
      totalStorageAndDemurrageBrl: round2(acc.totalStorageAndDemurrageBrl),
      avgCostOverFobPct,
      stockPlant0003: acc.stockPlant0003,
      severity,
      troubleSignals,
      recommendedFutureFix: fixParts.join('; ') + '.',
      linkedProcesses: Array.from(acc.processes),
    };

    materialTroubleMap.set(acc.materialCode, profile);
    materialTroubles.push(profile);
  }

  materialTroubles.sort((a, b) => {
    const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return (
      rank[b.severity] - rank[a.severity] ||
      b.totalStorageAndDemurrageBrl - a.totalStorageAndDemurrageBrl ||
      b.lateOrderCount - a.lateOrderCount ||
      b.totalSpendBrl - a.totalSpendBrl
    );
  });

  // 2. Per-Shipment Cost-vs-Order Worthiness & Air/Sea Verdict
  const rows: ShipmentCostBenefitRow[] = [];

  for (const proc of processes) {
    const fobBrl = round2(proc.brlFob);
    const cifBrl = round2(proc.brlCif);
    const intlFreightBrl = round2(proc.brlFrete);
    const insuranceBrl = round2(
      proc.items.reduce((s, i) => s + i.FUP_TOTAL_SEGURO_FISCAL_ITEM, 0)
    );
    const storageBrl = round2(proc.armazenagem);
    const capataziaBrl = round2(
      Math.max(...proc.items.map((i) => i.FUP_CAPATAZIA_PROCESSO), 0)
    );
    const afrmmBrl = round2(proc.afrmm);
    const truckingBrl = round2(proc.trucking);
    const brokerFeeBrl = round2(proc.brokerFee);
    const liFeeBrl = round2(proc.liFee);
    const ecotaxBrl = round2(proc.ecotax);
    const demurrageBrl = round2(proc.demurrageTotal);
    const customsTaxesBrl = round2(proc.impostos);

    const totalLogisticsCostBrl = round2(
      intlFreightBrl +
        insuranceBrl +
        storageBrl +
        capataziaBrl +
        afrmmBrl +
        truckingBrl +
        brokerFeeBrl +
        liFeeBrl +
        ecotaxBrl +
        demurrageBrl
    );
    const totalExtraCostBrl = round2(totalLogisticsCostBrl + customsTaxesBrl);
    const totalLandedBrl = round2(fobBrl + totalExtraCostBrl);
    const landedMultiplier = fobBrl > 0 ? round2(totalLandedBrl / fobBrl) : 1;

    const freightPctOverFob = pct(intlFreightBrl, fobBrl);
    const storagePctOverFob = pct(storageBrl + capataziaBrl, fobBrl);
    const logisticsPctOverFob = pct(totalLogisticsCostBrl, fobBrl);
    const taxesPctOverFob = pct(customsTaxesBrl, fobBrl);
    const totalExtraPctOverFob = pct(totalExtraCostBrl, fobBrl);

    const maxOrderDelayDays = Math.max(
      ...proc.items.map((i) => i.DIAS_ATRASO_ENTREGA || 0),
      0
    );
    const hasDelayedItem = proc.items.some(
      (i) => i.STATUS_PRAZO_ENTREGA === 'ATRASADO' || i.DIAS_ATRASO_ENTREGA > 0
    );
    const stockPlant0003Total = proc.items.reduce(
      (s, i) => s + (i.ESTOQUE_SOMA_TRES_CATEGORIAS_PLANTA_0003 || 0),
      0
    );
    const orderedQtyTotal = proc.items.reduce(
      (s, i) => s + (i.QUANTIDADE_PEDIDA || 0),
      0
    );
    const stockCoveragePct =
      orderedQtyTotal > 0
        ? Math.min(100, round2((stockPlant0003Total / orderedQtyTotal) * 100))
        : 0;

    // Observed avoidable waste strictly from recorded SAP penalty/excess-period storage
    const excessStorageBrl =
      proc.periodos > 1 && storageBrl > 0
        ? round2(storageBrl * ((proc.periodos - 1) / proc.periodos))
        : proc.status === 'PARADO AG. DRAWBACK' && storageBrl > 0
          ? storageBrl
          : 0;
    const observedAvoidableWasteBrl = round2(demurrageBrl + excessStorageBrl);

    // Linked SKU Historical Trouble Summary
    const linkedMatCodes = Array.from(
      new Set(
        proc.items
          .map((i) => (i.MATERIAL || i.DESCRICAO_MATERIAL || i.id).trim())
          .filter(Boolean)
      )
    );
    const linkedProfiles = linkedMatCodes
      .map((c) => materialTroubleMap.get(c))
      .filter((p): p is MaterialTroubleProfile => Boolean(p));

    const maxHistOrders = Math.max(...linkedProfiles.map((p) => p.orderCount), 0);
    const maxLateOrders = Math.max(
      ...linkedProfiles.map((p) => p.lateOrderCount),
      0
    );
    const maxRepeatAir = Math.max(
      ...linkedProfiles.map((p) => p.airShipmentCount),
      0
    );
    const maxMissingAc = Math.max(
      ...linkedProfiles.map((p) => p.missingAcCount),
      0
    );
    const histDelays = linkedProfiles
      .map((p) => p.avgDelayDays)
      .filter((d) => d > 0);
    const historicalDelayAvgDays =
      histDelays.length > 0
        ? round2(histDelays.reduce((s, d) => s + d, 0) / histDelays.length)
        : 0;
    const combinedSignals = Array.from(
      new Set(linkedProfiles.flatMap((p) => p.troubleSignals))
    );
    const hasRecurringTrouble = linkedProfiles.some(
      (p) => p.severity !== 'LOW' && p.troubleSignals.length > 0
    );

    const itemTroubleSummary: ShipmentItemTroubleSummary = {
      hasRecurringTrouble,
      lateOrderCount: maxLateOrders,
      totalHistoricalOrders: maxHistOrders,
      repeatAirCount: maxRepeatAir,
      historicalDelayAvgDays,
      missingAcOrders: maxMissingAc,
      affectedMaterials: linkedProfiles
        .filter((p) => p.troubleSignals.length > 0)
        .map((p) => `${p.materialCode} — ${p.descPt}`),
      troubleSignals: combinedSignals,
    };

    // Air vs Sea Evaluation
    const isAir =
      proc.modal === 'AÉREO' ||
      proc.items.some((i) => i.FUP_TIPO_EMBARQUE === 'A');
    const isStalledInCustoms =
      proc.status === 'PARADO AG. DRAWBACK' ||
      (proc.days > 10 && proc.desCi === '-');

    let airEvaluation: ShipmentAirEvaluation;
    if (!isAir) {
      airEvaluation = {
        isAir: false,
        verdict: 'NOT_APPLICABLE',
        headline: `${proc.modal || 'MARÍTIMO'} Modal`,
        rationale:
          proc.periodos >= 2 || demurrageBrl > 0
            ? `Consolidated ${proc.modal.toLowerCase()} freight (${freightPctOverFob}% of FOB), but port dwell (${proc.days}d / ${proc.periodos} periods) eroded modal savings.`
            : `Freight at ${freightPctOverFob}% of FOB with controlled ${proc.modal.toLowerCase()} execution.`,
        freightPctOverFob,
        airportDwellDays: proc.days,
        stockCoveragePct,
      };
    } else if (
      isStalledInCustoms ||
      (freightPctOverFob >= 15 && stockCoveragePct >= 50) ||
      (freightPctOverFob >= 15 && hasDelayedItem && proc.days > 7) ||
      (maxRepeatAir >= 2 && freightPctOverFob >= 12)
    ) {
      const reasons: string[] = [];
      if (isStalledInCustoms) {
        reasons.push(
          `cargo stalled at airport terminal (${proc.days}d, ${proc.status}) burning airport storage`
        );
      }
      if (stockCoveragePct >= 30) {
        reasons.push(
          `Plant 0003 already held ${stockCoveragePct}% stock coverage (${stockPlant0003Total} un)`
        );
      }
      if (hasDelayedItem) {
        reasons.push(`order still missed delivery SLA (+${maxOrderDelayDays}d)`);
      }
      if (maxRepeatAir >= 2) {
        reasons.push(`SKU shipped by Air ${maxRepeatAir} times`);
      }
      airEvaluation = {
        isAir: true,
        verdict: 'AVOIDABLE_AIR',
        headline: 'Air Speed Wasted — Bad Modal ROI',
        rationale: `Paid ${freightPctOverFob}% Air freight/FOB, yet ${reasons.join('; ') || 'dwell wiped out speed gains'}. Sea consolidation or pre-cleared AC would have saved substantial cost.`,
        freightPctOverFob,
        airportDwellDays: proc.days,
        stockCoveragePct,
      };
    } else if (
      freightPctOverFob >= 10 ||
      proc.days > 10 ||
      stockCoveragePct >= 50 ||
      hasDelayedItem
    ) {
      airEvaluation = {
        isAir: true,
        verdict: 'QUESTIONABLE_AIR',
        headline: 'Borderline Air Choice — Review Urgency',
        rationale: `Air freight consumed ${freightPctOverFob}% of FOB with ${proc.days}d airport dwell and ${stockCoveragePct}% Plant 0003 coverage. Confirm critical factory shortage before repeating Air.`,
        freightPctOverFob,
        airportDwellDays: proc.days,
        stockCoveragePct,
      };
    } else {
      airEvaluation = {
        isAir: true,
        verdict: 'JUSTIFIED_AIR',
        headline: 'Air Justified — Fast Clearance & SLA Met',
        rationale: `Controlled air freight (${freightPctOverFob}% of FOB), fast ${proc.transitTime || 3}d transit and ${proc.days}d clearance with zero delivery delay.`,
        freightPctOverFob,
        airportDwellDays: proc.days,
        stockCoveragePct,
      };
    }

    // Check Drawback-eligible NCM without AC
    const hasMissingDrawbackAc = proc.items.some((i) => {
      const elig = i.FUP_NCMS
        .split(',')
        .some((n) => isDrawbackExpectedNcm(n.trim()));
      return elig && !i.FUP_ATO_CONCESSORIO;
    });
    const isExw = (proc.incoterm || '').toUpperCase().startsWith('EXW');

    // Recommendations Engine (concrete Comex + Purchasing fixes)
    const recommendations: CostOptimizationAction[] = [];

    if (hasMissingDrawbackAc || proc.status === 'PARADO AG. DRAWBACK') {
      recommendations.push({
        code: 'LINK_DRAWBACK_AC',
        category: 'DRAWBACK_AC',
        priority: 'HIGH',
        title: 'Pre-link Drawback Ato Concessório before ETD',
        detail: `Process holds eligible NCM without linked AC (${proc.status}). Attaching AC prior to arrival avoids customs suspension holds and extra terminal storage (${storageBrl > 0 ? `R$ ${storageBrl.toLocaleString('pt-BR')}` : 'pending terminal fees'}).`,
        observedWasteBrl: excessStorageBrl,
      });
    }

    if (airEvaluation.verdict === 'AVOIDABLE_AIR') {
      recommendations.push({
        code: 'SHIFT_AIR_TO_SEA',
        category: 'MODAL',
        priority: 'HIGH',
        title: 'Avoid reactive Air Freight — shift recurring SKU to Sea LCL/FCL',
        detail:
          airEvaluation.rationale +
          ' Trigger PO release 45 days earlier in MRP so Sea modal satisfies production date.',
        observedWasteBrl: excessStorageBrl,
      });
    } else if (airEvaluation.verdict === 'QUESTIONABLE_AIR') {
      recommendations.push({
        code: 'AUDIT_AIR_TRIGGER',
        category: 'MODAL',
        priority: 'MEDIUM',
        title: 'Require Plant-0003 stockout sign-off before approving Air booking',
        detail: `Plant 0003 holds ${stockPlant0003Total} units (${stockCoveragePct}% of PO qty). Verify line-stop risk before paying Air premium (${freightPctOverFob}% of FOB).`,
        observedWasteBrl: 0,
      });
    }

    if (demurrageBrl > 0) {
      recommendations.push({
        code: 'NEGOTIATE_DEMURRAGE_FT',
        category: 'STORAGE_PORT',
        priority: 'HIGH',
        title: 'Eliminate Container Demurrage via 21d Free-Time & fast return',
        detail: `Process recorded R$ ${demurrageBrl.toLocaleString('pt-BR')} in demurrage. Negotiate >=21d combined free-time with carrier and prioritize empty container return post-MIGO.`,
        observedWasteBrl: demurrageBrl,
      });
    } else if (proc.periodos >= 2) {
      recommendations.push({
        code: 'PRE_CLEAR_PERIOD_1',
        category: 'STORAGE_PORT',
        priority: 'HIGH',
        title: `Cut port/airport storage (${proc.periodos} periods / ${proc.days}d) down to Period 1`,
        detail: `Cargo crossed into Storage Period ${proc.periodos}. Pre-file DI draft, validate NCM docs, and advance Numerário 5 days before ETA to release within 10 days.`,
        observedWasteBrl: excessStorageBrl,
      });
    }

    if (isExw) {
      recommendations.push({
        code: 'INCOTERM_EXW_TO_FCA',
        category: 'INCOTERM',
        priority: 'MEDIUM',
        title: 'Renegotiate Incoterm from EXW to FCA/FOB',
        detail:
          'EXW forces MFX to pay origin inland pickup, export customs clearance, and destination handling add-ons. Switching to FCA at next RFQ cuts origin fees.',
        observedWasteBrl: 0,
      });
    }

    if (hasRecurringTrouble && maxLateOrders >= 1) {
      recommendations.push({
        code: 'SUPPLIER_SLA_REVIEW',
        category: 'SUPPLIER_SLA',
        priority: maxLateOrders >= 2 || maxOrderDelayDays >= 14 ? 'HIGH' : 'MEDIUM',
        title: 'Address recurring supplier/SKU delay risk on future POs',
        detail: `${proc.exporter} / SKU had ${maxLateOrders} late order(s) (avg delay ${historicalDelayAvgDays || maxOrderDelayDays}d). Enforce contractual delivery SLA, add buffer lead time, or qualify dual source.`,
        observedWasteBrl: 0,
      });
    }

    if (proc.canal === 'VERMELHO' || proc.canal === 'AMARELO') {
      recommendations.push({
        code: 'CHANNEL_DOC_COMPLIANCE',
        category: 'PURCHASING_BATCH',
        priority: 'MEDIUM',
        title: `Pre-audit NCM & Invoice specs (${proc.canal} Channel)`,
        detail: `Parametrized in ${proc.canal} channel, increasing inspection dwell (${proc.days}d). Standardize bilingual technical catalog & certificate package with exporter before ETD.`,
        observedWasteBrl: 0,
      });
    }

    // Executive Worthiness Verdict (separating controllable logistics/modal failures from statutory taxes)
    const worthinessReasons: string[] = [];
    const isNotWorthIt =
      logisticsPctOverFob >= 22 ||
      demurrageBrl > 0 ||
      airEvaluation.verdict === 'AVOIDABLE_AIR' ||
      (proc.periodos >= 3 && storagePctOverFob >= 3);

    const isReview =
      !isNotWorthIt &&
      (totalExtraPctOverFob >= 45 ||
        logisticsPctOverFob >= 12 ||
        proc.periodos >= 2 ||
        hasMissingDrawbackAc ||
        airEvaluation.verdict === 'QUESTIONABLE_AIR' ||
        (hasRecurringTrouble && maxLateOrders >= 2));

    const worthinessVerdict: ShipmentWorthinessVerdict = isNotWorthIt
      ? 'NOT_WORTH_IT'
      : isReview
        ? 'REVIEW'
        : 'EFFICIENT';

    if (logisticsPctOverFob >= 22) {
      worthinessReasons.push(
        `Logistics & port fees consumed ${logisticsPctOverFob}% of Order FOB`
      );
    } else if (logisticsPctOverFob >= 12) {
      worthinessReasons.push(
        `Elevated logistics cost ratio (${logisticsPctOverFob}% of FOB)`
      );
    }

    if (totalExtraPctOverFob >= 45) {
      worthinessReasons.push(
        `High total landed burden (+${totalExtraPctOverFob}% w/ SAP taxes — review Drawback/sourcing)`
      );
    } else if (totalExtraPctOverFob >= 25) {
      worthinessReasons.push(
        `Elevated total extra burden (${totalExtraPctOverFob}% over FOB)`
      );
    }

    if (demurrageBrl > 0) {
      worthinessReasons.push(
        `Container demurrage incurred (R$ ${demurrageBrl.toLocaleString('pt-BR')})`
      );
    }
    if (airEvaluation.verdict === 'AVOIDABLE_AIR') {
      worthinessReasons.push('Air freight premium wasted (blocked/unnecessary urgency)');
    } else if (airEvaluation.verdict === 'QUESTIONABLE_AIR') {
      worthinessReasons.push('Air freight urgency needs confirmation');
    }
    if (proc.periodos >= 2) {
      worthinessReasons.push(
        `Extended terminal storage (${proc.periodos} periods · ${proc.days}d)`
      );
    }
    if (hasMissingDrawbackAc) {
      worthinessReasons.push('Eligible NCM shipped without Drawback AC');
    }
    if (worthinessReasons.length === 0) {
      worthinessReasons.push(
        `Controlled extra cost (${totalExtraPctOverFob}% over FOB) with clean clearance`
      );
    }

    rows.push({
      ref: proc.ref,
      poList: proc.poList,
      exporter: proc.exporter,
      pepProject: proc.linha,
      modal: proc.modal,
      incoterm: proc.incoterm,
      status: proc.status,
      canal: proc.canal,
      etd: proc.etd,
      eta: proc.eta,
      fobBrl,
      cifBrl,
      intlFreightBrl,
      insuranceBrl,
      storageBrl,
      capataziaBrl,
      afrmmBrl,
      truckingBrl,
      brokerFeeBrl,
      liFeeBrl,
      ecotaxBrl,
      demurrageBrl,
      customsTaxesBrl,
      totalLogisticsCostBrl,
      totalExtraCostBrl,
      totalLandedBrl,
      landedMultiplier,
      freightPctOverFob,
      storagePctOverFob,
      logisticsPctOverFob,
      taxesPctOverFob,
      totalExtraPctOverFob,
      daysInPort: proc.days,
      periodos: proc.periodos,
      transitTime: proc.transitTime,
      leadTime: proc.leadTime,
      maxOrderDelayDays,
      stockPlant0003Total,
      observedAvoidableWasteBrl,
      worthinessVerdict,
      worthinessReasons,
      airEvaluation,
      itemTroubleSummary,
      recommendations,
      process: proc,
    });
  }

  // Sort critical Overruns first, then Review, then Efficient, ordered by extra cost %
  const verdictOrder: Record<ShipmentWorthinessVerdict, number> = {
    NOT_WORTH_IT: 0,
    REVIEW: 1,
    EFFICIENT: 2,
  };
  rows.sort(
    (a, b) =>
      verdictOrder[a.worthinessVerdict] - verdictOrder[b.worthinessVerdict] ||
      b.observedAvoidableWasteBrl - a.observedAvoidableWasteBrl ||
      b.totalExtraPctOverFob - a.totalExtraPctOverFob ||
      a.ref.localeCompare(b.ref)
  );

  const totalFobBrl = round2(rows.reduce((s, r) => s + r.fobBrl, 0));
  const totalLogisticsCostBrl = round2(
    rows.reduce((s, r) => s + r.totalLogisticsCostBrl, 0)
  );
  const totalTaxesBrl = round2(rows.reduce((s, r) => s + r.customsTaxesBrl, 0));
  const totalExtraCostBrl = round2(
    rows.reduce((s, r) => s + r.totalExtraCostBrl, 0)
  );
  const totalLandedBrl = round2(rows.reduce((s, r) => s + r.totalLandedBrl, 0));

  const totalIntlFreight = round2(
    rows.reduce((s, r) => s + r.intlFreightBrl, 0)
  );
  const totalStorageAndCapatazia = round2(
    rows.reduce((s, r) => s + r.storageBrl + r.capataziaBrl, 0)
  );
  const totalDemurrage = round2(rows.reduce((s, r) => s + r.demurrageBrl, 0));
  const totalOtherFees = round2(
    rows.reduce(
      (s, r) =>
        s +
        r.insuranceBrl +
        r.afrmmBrl +
        r.truckingBrl +
        r.brokerFeeBrl +
        r.liFeeBrl +
        r.ecotaxBrl,
      0
    )
  );

  const airRows = rows.filter((r) => r.airEvaluation.isAir);
  const troubleSkus = materialTroubles.filter((m) => m.troubleSignals.length > 0);

  return {
    rows,
    materialTroubles,
    summary: {
      totalShipments: rows.length,
      totalFobBrl,
      totalLogisticsCostBrl,
      totalTaxesBrl,
      totalExtraCostBrl,
      totalLandedBrl,
      weightedExtraPctOverFob: pct(totalExtraCostBrl, totalFobBrl),
      weightedLogisticsPctOverFob: pct(totalLogisticsCostBrl, totalFobBrl),
      efficientCount: rows.filter((r) => r.worthinessVerdict === 'EFFICIENT').length,
      reviewCount: rows.filter((r) => r.worthinessVerdict === 'REVIEW').length,
      notWorthItCount: rows.filter((r) => r.worthinessVerdict === 'NOT_WORTH_IT')
        .length,
      airShipmentCount: airRows.length,
      justifiedAirCount: airRows.filter(
        (r) => r.airEvaluation.verdict === 'JUSTIFIED_AIR'
      ).length,
      questionableOrAvoidableAirCount: airRows.filter(
        (r) =>
          r.airEvaluation.verdict === 'AVOIDABLE_AIR' ||
          r.airEvaluation.verdict === 'QUESTIONABLE_AIR'
      ).length,
      recurringTroubleSkuCount: troubleSkus.length,
      highTroubleSkuCount: troubleSkus.filter((m) => m.severity === 'HIGH').length,
      observedAvoidableWasteBrl: round2(
        rows.reduce((s, r) => s + r.observedAvoidableWasteBrl, 0)
      ),
    },
    chartCostRatioByProcess: rows.slice(0, 10).map((r) => ({
      name: r.ref.replace('MFX-000', 'MFX-').replace('MFX-00', 'MFX-'),
      processRef: r.ref,
      fobBrl: Math.round(r.fobBrl),
      logisticsBrl: Math.round(r.totalLogisticsCostBrl),
      taxesBrl: Math.round(r.customsTaxesBrl),
      extraPctOverFob: r.totalExtraPctOverFob,
      verdict: r.worthinessVerdict,
    })),
    chartWasteDrivers: [
      {
        name: 'Customs Taxes (SAP)',
        key: 'taxes',
        valueBrl: totalTaxesBrl,
        color: '#8b5cf6',
      },
      {
        name: 'Intl Freight',
        key: 'freight',
        valueBrl: totalIntlFreight,
        color: '#06b6d4',
      },
      {
        name: 'Port Storage & Capatazia',
        key: 'storage',
        valueBrl: totalStorageAndCapatazia,
        color: '#f59e0b',
      },
      {
        name: 'Demurrage',
        key: 'demurrage',
        valueBrl: totalDemurrage,
        color: '#ef4444',
      },
      {
        name: 'Insurance & Local Fees',
        key: 'other',
        valueBrl: totalOtherFees,
        color: '#64748b',
      },
    ],
  };
}

export function buildComexChartsAnalytics(
  items: FupItemRow[],
  processes: ShipmentProcessRow[]
): ComexChartsAnalyticsResult {
  const round1 = (v: number): number =>
    Math.round((Number.isFinite(v) ? v : 0) * 10) / 10;
  const round2 = (v: number): number =>
    Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;

  const nonDeleted = items.filter(
    (i) => i.LOEKZ !== 'L' && i.STATUS_PRAZO_ENTREGA !== 'ITEM EXCLUIDO'
  );

  const totalShipments = processes.length;
  const uniquePoSet = new Set(nonDeleted.map((i) => i.PEDIDO).filter(Boolean));
  const totalPoCount = uniquePoSet.size;
  const totalItemLines = nonDeleted.length;
  const registeredDiCount = processes.filter((p) => p.canal !== '-').length;

  // 1. Quantity of Shipments by Operational Stage
  const stageOrder: Array<{ stage: ShipmentOperationalStatus; color: string }> = [
    { stage: 'AG. PRONTIDAO DA CARGA', color: '#64748b' },
    { stage: 'EM TRÂNSITO', color: '#06b6d4' },
    { stage: 'AG. DESEMBARAÇO', color: '#f59e0b' },
    { stage: 'PARADO AG. DRAWBACK', color: '#f43f5e' },
    { stage: 'ENTREGUE', color: '#10b981' },
  ];

  const shipmentsByStage = stageOrder.map(({ stage, color }) => {
    const matched = processes.filter((p) => p.status === stage);
    const count = matched.length;
    const pct = totalShipments > 0 ? round1((count / totalShipments) * 100) : 0;
    const fobBrl = round2(matched.reduce((s, p) => s + p.brlFob, 0));
    return { stage, count, pct, fobBrl, color };
  });

  // 2. Channels of Customs (DI Parametrization)
  const channelOrder: Array<{
    key: 'VERDE' | 'AMARELO' | 'VERMELHO' | 'CINZA' | '-';
    color: string;
  }> = [
    { key: 'VERDE', color: '#10b981' },
    { key: 'AMARELO', color: '#f59e0b' },
    { key: 'VERMELHO', color: '#f43f5e' },
    { key: 'CINZA', color: '#64748b' },
    { key: '-', color: '#06b6d4' },
  ];

  const customsChannels = channelOrder.map(({ key, color }) => {
    const matched = processes.filter((p) => p.canal === key);
    const count = matched.length;
    const pct = totalShipments > 0 ? round1((count / totalShipments) * 100) : 0;
    const fobBrl = round2(matched.reduce((s, p) => s + p.brlFob, 0));
    return { key, count, pct, fobBrl, color };
  });

  // 3. Quantity of Containers & Modal Mix
  const total20Cntr = processes.reduce((s, p) => s + p.c20, 0);
  const total40Cntr = processes.reduce((s, p) => s + p.c40, 0);
  const totalContainers = total20Cntr + total40Cntr;
  const totalTeus = total20Cntr + total40Cntr * 2;
  const seaShipments = processes.filter((p) => p.modal === 'MARÍTIMO').length;
  const airShipments = processes.filter((p) => p.modal === 'AÉREO').length;
  const roadShipments = processes.filter((p) => p.modal === 'RODOVIÁRIO').length;

  const containerMix: ComexChartsAnalyticsResult['containerMix'] = [
    { key: 'CNTR_20', count: total20Cntr, color: '#06b6d4' },
    { key: 'CNTR_40', count: total40Cntr, color: '#6366f1' },
    { key: 'TEUS', count: totalTeus, color: '#3b82f6' },
    { key: 'SEA', count: seaShipments, color: '#10b981' },
    { key: 'AIR', count: airShipments, color: '#f59e0b' },
  ];
  if (roadShipments > 0) {
    containerMix.push({ key: 'ROAD', count: roadShipments, color: '#8b5cf6' });
  }

  const containersByProcess = processes.map((p) => ({
    processRef: p.ref,
    shortRef: p.ref.replace(/^MFX-0*/i, 'MFX-'),
    c20: p.c20,
    c40: p.c40,
    teus: p.c20 + p.c40 * 2,
    modal: p.modal,
  }));

  // 4. Costs of Freight (BRL)
  const totalIntlFreightBrl = round2(processes.reduce((s, p) => s + p.brlFrete, 0));
  const totalNationalFreightBrl = round2(processes.reduce((s, p) => s + p.trucking, 0));
  const totalFreightBrl = round2(totalIntlFreightBrl + totalNationalFreightBrl);
  const totalShippedFobBrl = round2(processes.reduce((s, p) => s + p.brlFob, 0));
  const freightPctOfFob =
    totalShippedFobBrl > 0 ? round1((totalFreightBrl / totalShippedFobBrl) * 100) : 0;

  const freightByProcess = processes.map((p) => {
    const intlFreightBrl = round2(p.brlFrete);
    const natFreightBrl = round2(p.trucking);
    const procTotalFreight = round2(intlFreightBrl + natFreightBrl);
    const freightPctFob = p.brlFob > 0 ? round1((procTotalFreight / p.brlFob) * 100) : 0;
    return {
      processRef: p.ref,
      shortRef: p.ref.replace(/^MFX-0*/i, 'MFX-'),
      exporterShort: p.exporter.split(' ')[0] || '-',
      modal: p.modal,
      intlFreightBrl,
      natFreightBrl,
      totalFreightBrl: procTotalFreight,
      freightPctFob,
    };
  });

  // 5. Tax (Strict SAP Recorded Customs Taxes — never guess or estimate when SAP is 0)
  const iiBrl = round2(nonDeleted.reduce((s, i) => s + i.FUP_TOTAL_II_ITEM, 0));
  const ipiBrl = round2(nonDeleted.reduce((s, i) => s + i.FUP_TOTAL_IPI_ITEM, 0));
  const pisBrl = round2(nonDeleted.reduce((s, i) => s + i.FUP_TOTAL_PIS_ITEM, 0));
  const cofinsBrl = round2(nonDeleted.reduce((s, i) => s + i.FUP_TOTAL_COFINS_ITEM, 0));
  const icmsBrl = round2(nonDeleted.reduce((s, i) => s + i.FUP_TOTAL_ICMS_ITEM, 0));
  const siscomexBrl = round2(nonDeleted.reduce((s, i) => s + i.FUP_TOTAL_SISCOMEX_ITEM, 0));
  const afrmmBrl = round2(processes.reduce((s, p) => s + p.afrmm, 0));
  const totalTaxesBrl = round2(
    iiBrl + ipiBrl + pisBrl + cofinsBrl + icmsBrl + siscomexBrl + afrmmBrl
  );

  const taxByType: ComexChartsAnalyticsResult['taxByType'] = [
    { key: 'ICMS', valueBrl: icmsBrl, color: '#8b5cf6' },
    { key: 'II', valueBrl: iiBrl, color: '#06b6d4' },
    { key: 'COFINS', valueBrl: cofinsBrl, color: '#3b82f6' },
    { key: 'IPI', valueBrl: ipiBrl, color: '#f59e0b' },
    { key: 'PIS', valueBrl: pisBrl, color: '#10b981' },
    { key: 'SISCOMEX', valueBrl: siscomexBrl, color: '#ec4899' },
    { key: 'AFRMM', valueBrl: afrmmBrl, color: '#64748b' },
  ];

  const taxByProcess = processes.map((p) => {
    const pIi = round2(p.items.reduce((s, i) => s + i.FUP_TOTAL_II_ITEM, 0));
    const pIpi = round2(p.items.reduce((s, i) => s + i.FUP_TOTAL_IPI_ITEM, 0));
    const pPisCofins = round2(
      p.items.reduce((s, i) => s + i.FUP_TOTAL_PIS_ITEM + i.FUP_TOTAL_COFINS_ITEM, 0)
    );
    const pIcms = round2(p.items.reduce((s, i) => s + i.FUP_TOTAL_ICMS_ITEM, 0));
    const pSisAfrmm = round2(
      p.items.reduce((s, i) => s + i.FUP_TOTAL_SISCOMEX_ITEM, 0) + p.afrmm
    );
    const pTotal = round2(pIi + pIpi + pPisCofins + pIcms + pSisAfrmm);
    return {
      processRef: p.ref,
      shortRef: p.ref.replace(/^MFX-0*/i, 'MFX-'),
      regime: p.regTrib,
      iiBrl: pIi,
      ipiBrl: pIpi,
      pisCofinsBrl: pPisCofins,
      icmsBrl: pIcms,
      siscomexAfrmmBrl: pSisAfrmm,
      totalTaxesBrl: pTotal,
    };
  });

  // 6. Delays Totalized
  const onTimeLines = nonDeleted.filter((i) => i.STATUS_PRAZO_ENTREGA === 'NO PRAZO');
  const completedLines = nonDeleted.filter(
    (i) => i.STATUS_PRAZO_ENTREGA === 'ENTREGA CONCLUIDA SAP'
  );
  const delayedLines = nonDeleted.filter(
    (i) => i.STATUS_PRAZO_ENTREGA === 'ATRASADO' || i.DIAS_ATRASO_ENTREGA > 0
  );
  const delayedPoSet = new Set(delayedLines.map((i) => i.PEDIDO).filter(Boolean));
  const delayedPoCount = delayedPoSet.size;
  const delayedLineCount = delayedLines.length;
  const totalDelayDays = delayedLines.reduce(
    (s, i) => s + Math.max(0, i.DIAS_ATRASO_ENTREGA),
    0
  );
  const avgDelayDays =
    delayedLineCount > 0 ? round1(totalDelayDays / delayedLineCount) : 0;
  const maxDelayDays =
    delayedLineCount > 0
      ? Math.max(...delayedLines.map((i) => Math.max(0, i.DIAS_ATRASO_ENTREGA)))
      : 0;
  const onTimeRatePct =
    nonDeleted.length > 0
      ? round1(((onTimeLines.length + completedLines.length) / nonDeleted.length) * 100)
      : 100;

  const delaysByStatus: ComexChartsAnalyticsResult['delaysByStatus'] = [
    {
      statusKey: 'ON_TIME',
      lineCount: onTimeLines.length,
      totalDelayDays: 0,
      color: '#06b6d4',
    },
    {
      statusKey: 'COMPLETED',
      lineCount: completedLines.length,
      totalDelayDays: 0,
      color: '#10b981',
    },
    {
      statusKey: 'DELAYED',
      lineCount: delayedLineCount,
      totalDelayDays,
      color: '#f43f5e',
    },
  ];

  const poDelayMap = new Map<
    string,
    {
      poNumber: string;
      processRef: string;
      supplierShort: string;
      delayDays: number;
      pendingQty: number;
      valueBrl: number;
    }
  >();
  for (const item of nonDeleted) {
    const po = item.PEDIDO || item.id;
    const fx =
      item.MOEDA === 'BRL'
        ? 1
        : item.MOEDA === 'EUR'
          ? item.FUP_TAXA_EURO_PROCESSO || 6.12
          : item.FUP_TAXA_DOLAR_PROCESSO || 5.65;
    const valBrl =
      item.FUP_VALOR_MERCADORIA > 0
        ? item.FUP_VALOR_MERCADORIA
        : item.FUP_VALOR_FOB_REAIS_PROCESSO > 0
          ? item.FUP_VALOR_FOB_REAIS_PROCESSO
          : item.VALOR_LIQUIDO * fx;
    const existing = poDelayMap.get(po);
    if (!existing) {
      poDelayMap.set(po, {
        poNumber: po,
        processRef: item.ULTIMO_PROCESSO_IMPORTACAO || '-',
        supplierShort: (item.NOME_FORNECEDOR || '-').split(' ')[0],
        delayDays: Math.max(0, item.DIAS_ATRASO_ENTREGA),
        pendingQty: Math.max(0, item.QUANTIDADE_PENDENTE),
        valueBrl: round2(valBrl),
      });
    } else {
      existing.delayDays = Math.max(existing.delayDays, Math.max(0, item.DIAS_ATRASO_ENTREGA));
      existing.pendingQty += Math.max(0, item.QUANTIDADE_PENDENTE);
      existing.valueBrl = round2(existing.valueBrl + valBrl);
    }
  }

  const delaysByPo = Array.from(poDelayMap.values())
    .sort((a, b) => b.delayDays - a.delayDays || b.pendingQty - a.pendingQty)
    .slice(0, 8);

  // 7. Time of Customs Clearance (Days)
  const clearanceSamples: number[] = [];
  const clearanceByProcess = processes.map((p) => {
    const first = p.items[0];
    const presencaIso = first?.FUP_DATA_PRESENCA_CARGA || '';
    const diIso = first?.DATA_DI || '';
    const desIso = first?.DATA_DESEMBARACO || '';

    const isCleared = Boolean(desIso);
    const presenceToDiDays =
      presencaIso && diIso ? Math.max(0, daysBetween(presencaIso, diIso)) : 0;
    const diToReleaseDays =
      diIso && desIso
        ? Math.max(1, daysBetween(diIso, desIso))
        : !isCleared && diIso && presencaIso
          ? Math.max(1, p.days - presenceToDiDays)
          : 0;
    const totalClearanceDays =
      presencaIso && desIso
        ? Math.max(1, daysBetween(presencaIso, desIso))
        : p.days;

    if (isCleared && totalClearanceDays > 0) {
      clearanceSamples.push(totalClearanceDays);
    }

    const color =
      p.canal === 'VERDE'
        ? '#10b981'
        : p.canal === 'AMARELO'
          ? '#f59e0b'
          : p.canal === 'VERMELHO'
            ? '#f43f5e'
            : '#06b6d4';

    return {
      processRef: p.ref,
      shortRef: p.ref.replace(/^MFX-0*/i, 'MFX-'),
      canal: p.canal,
      presenceToDiDays,
      diToReleaseDays,
      totalClearanceDays,
      isCleared,
      color,
    };
  });

  const avgClearanceDays =
    clearanceSamples.length > 0
      ? round1(clearanceSamples.reduce((s, d) => s + d, 0) / clearanceSamples.length)
      : 0;
  const clearedProcessCount = clearanceByProcess.filter((c) => c.isCleared).length;

  // 8. Time of NF Issue & Factory Receiving Turnaround
  const nfSamples: number[] = [];
  let nfIssuedCount = 0;
  let nfPendingCount = 0;

  const nfByProcess = processes.map((p) => {
    const first = p.items[0];
    const procJson = first?.processos[0] || {};
    const desIso = first?.DATA_DESEMBARACO || '';
    const nfOrRecIso =
      procJson.DT_NF ||
      procJson.DATA_NF ||
      first?.DATA_ENTREGA_MFX ||
      first?.ULTIMA_DATA_RECEBIMENTO ||
      '';
    const hasNfIssued =
      (p.nfNum && p.nfNum !== '-') ||
      p.nfStatus === 'EMITIDA' ||
      p.status === 'ENTREGUE';

    let nfStatusKey: 'ISSUED' | 'PENDING_NF' | 'AWAITING_CLEARANCE';
    let turnaroundDays = 0;
    let color = '#64748b';

    if (hasNfIssued) {
      nfStatusKey = 'ISSUED';
      nfIssuedCount += 1;
      turnaroundDays =
        desIso && nfOrRecIso
          ? Math.max(1, daysBetween(desIso, nfOrRecIso))
          : 1;
      nfSamples.push(turnaroundDays);
      color = '#10b981';
    } else if (desIso) {
      nfStatusKey = 'PENDING_NF';
      nfPendingCount += 1;
      turnaroundDays = Math.max(
        1,
        daysBetween(desIso, new Date().toISOString().slice(0, 10))
      );
      color = '#f59e0b';
    } else {
      nfStatusKey = 'AWAITING_CLEARANCE';
      nfPendingCount += 1;
      turnaroundDays = p.days;
      color = '#f43f5e';
    }

    return {
      processRef: p.ref,
      shortRef: p.ref.replace(/^MFX-0*/i, 'MFX-'),
      nfNumber: p.nfNum !== '-' ? p.nfNum : '-',
      nfStatusKey,
      turnaroundDays,
      color,
    };
  });

  const avgNfTurnaroundDays =
    nfSamples.length > 0
      ? round1(nfSamples.reduce((s, d) => s + d, 0) / nfSamples.length)
      : 0;

  const nfStatusOrder: Array<{
    statusKey: 'ISSUED' | 'PENDING_NF' | 'AWAITING_CLEARANCE';
    color: string;
  }> = [
    { statusKey: 'ISSUED', color: '#10b981' },
    { statusKey: 'PENDING_NF', color: '#f59e0b' },
    { statusKey: 'AWAITING_CLEARANCE', color: '#f43f5e' },
  ];

  const nfStatusSummary = nfStatusOrder.map(({ statusKey, color }) => {
    const matchedRefs = new Set(
      nfByProcess.filter((n) => n.nfStatusKey === statusKey).map((n) => n.processRef)
    );
    const matchedProcs = processes.filter((p) => matchedRefs.has(p.ref));
    return {
      statusKey,
      count: matchedProcs.length,
      fobBrl: round2(matchedProcs.reduce((s, p) => s + p.brlFob, 0)),
      color,
    };
  });

  // 9. Time of Delivery (Transit ETD->ETA vs Port/Clearance vs Total Lead Time)
  const transitSamples: number[] = [];
  const leadTimeSamples: number[] = [];

  const deliveryByProcess = processes.map((p) => {
    const transitDays = p.transitTime;
    const totalLeadTimeDays = p.leadTime > 0 ? p.leadTime : transitDays + p.days;
    const portAndClearanceDays = Math.max(0, totalLeadTimeDays - transitDays || p.days);

    if (transitDays > 0) transitSamples.push(transitDays);
    if (totalLeadTimeDays > 0) leadTimeSamples.push(totalLeadTimeDays);

    return {
      processRef: p.ref,
      shortRef: p.ref.replace(/^MFX-0*/i, 'MFX-'),
      modal: p.modal,
      transitDays,
      portAndClearanceDays,
      totalLeadTimeDays,
    };
  });

  const avgTransitDays =
    transitSamples.length > 0
      ? round1(transitSamples.reduce((s, d) => s + d, 0) / transitSamples.length)
      : 0;
  const avgLeadTimeDays =
    leadTimeSamples.length > 0
      ? round1(leadTimeSamples.reduce((s, d) => s + d, 0) / leadTimeSamples.length)
      : 0;

  // 10. Time of Storage (Terminal Dwell Days, 10d Periods & Cost BRL)
  const storageSamples = processes.map((p) => p.days).filter((d) => d > 0);
  const avgStorageDays =
    storageSamples.length > 0
      ? round1(storageSamples.reduce((s, d) => s + d, 0) / storageSamples.length)
      : 0;
  const totalStoragePeriods = processes.reduce((s, p) => s + p.periodos, 0);
  const totalStorageCostBrl = round2(processes.reduce((s, p) => s + p.armazenagem, 0));

  const storageByProcess = processes.map((p) => ({
    processRef: p.ref,
    shortRef: p.ref.replace(/^MFX-0*/i, 'MFX-'),
    terminal: p.terminal !== '-' ? p.terminal : 'Terminal',
    storageDays: p.days,
    storagePeriods: p.periodos,
    storageCostBrl: round2(p.armazenagem),
    color: p.periodos >= 3 ? '#f43f5e' : p.periodos === 2 ? '#f59e0b' : '#10b981',
  }));

  // 11. Invoices Values (BRL by Process + MIRO/FI Financial Settlement Status)
  const invoicesByProcess: ComexChartsAnalyticsResult['invoicesByProcess'] = processes.map(
    (p) => {
      const hasOverdue = p.items.some(
        (i) =>
          i.FUP_QTD_MIRO_VENCIDAS > 0 ||
          i.FUP_STATUS_FINANCEIRO_ATIVAS === 'VENCIDA'
      );
      const isPaid =
        Boolean(p.paid && p.paid !== '-') ||
        p.items.some((i) => i.FUP_STATUS_FINANCEIRO_ATIVAS === 'COMPENSADA');
      const miroStatusKey: 'PAID' | 'UPCOMING' | 'OVERDUE' | 'PROJECTED' = hasOverdue
        ? 'OVERDUE'
        : isPaid
          ? 'PAID'
          : p.miro !== '-'
            ? 'UPCOMING'
            : 'PROJECTED';
      const color =
        miroStatusKey === 'PAID'
          ? '#10b981'
          : miroStatusKey === 'OVERDUE'
            ? '#f43f5e'
            : miroStatusKey === 'UPCOMING'
              ? '#06b6d4'
              : '#6366f1';

      return {
        processRef: p.ref,
        shortRef: p.ref.replace(/^MFX-0*/i, 'MFX-'),
        exporterShort: p.exporter.split(' ')[0] || '-',
        currency: p.currency,
        invoiceOrig: round2(p.invoiceValue),
        invoiceBrl: round2(p.brlInvoice),
        cifBrl: round2(p.brlCif),
        miroStatusKey,
        color,
      };
    }
  );

  // Also include unshipped open POs in Open PO total and Financial Status
  let totalOpenPoBrl = 0;
  for (const item of nonDeleted) {
    if (!item.ULTIMO_PROCESSO_IMPORTACAO && item.QUANTIDADE_PENDENTE > 0) {
      const fx =
        item.MOEDA === 'BRL'
          ? 1
          : item.MOEDA === 'EUR'
            ? item.FUP_TAXA_EURO_PROCESSO || 6.12
            : item.FUP_TAXA_DOLAR_PROCESSO || 5.65;
      const ratio =
        item.QUANTIDADE_PEDIDA > 0
          ? item.QUANTIDADE_PENDENTE / item.QUANTIDADE_PEDIDA
          : 1;
      totalOpenPoBrl += item.VALOR_LIQUIDO * ratio * fx;
    }
  }
  totalOpenPoBrl = round2(totalOpenPoBrl);

  const cashFlowEntries = buildCashFlowData(nonDeleted, processes).filter(
    (e) => e.source === 'MIRO/FI'
  );
  const finStatusOrder: Array<{
    statusKey: 'PAID' | 'UPCOMING' | 'OVERDUE' | 'PROJECTED';
    sapStatus: CashFlowEntry['status'];
    color: string;
  }> = [
    { statusKey: 'PAID', sapStatus: 'PAGO', color: '#10b981' },
    { statusKey: 'UPCOMING', sapStatus: 'A VENCER', color: '#06b6d4' },
    { statusKey: 'OVERDUE', sapStatus: 'VENCIDA', color: '#f43f5e' },
    { statusKey: 'PROJECTED', sapStatus: 'PROJETADO', color: '#6366f1' },
  ];

  const invoicesByFinancialStatus = finStatusOrder.map(
    ({ statusKey, sapStatus, color }) => {
      const matched = cashFlowEntries.filter((e) => e.status === sapStatus);
      return {
        statusKey,
        count: matched.length,
        amountBrl: round2(matched.reduce((s, e) => s + e.amountBrl, 0)),
        color,
      };
    }
  );

  const totalInvoicesBrl = round2(
    invoicesByFinancialStatus.reduce((s, f) => s + f.amountBrl, 0) ||
      totalShippedFobBrl + totalOpenPoBrl
  );

  // 12. Relevant Department & Team Results (PEP Projects + Drawback Coverage + Team Performance)
  let drawbackFobBrl = 0;
  let fullTaxFobBrl = 0;

  const pepMap = new Map<
    string,
    {
      pepCode: string;
      pepLabel: string;
      drawbackBrl: number;
      fullTaxBrl: number;
      orderedQty: number;
      receivedQty: number;
    }
  >();

  for (const item of nonDeleted) {
    const fx =
      item.MOEDA === 'BRL'
        ? 1
        : item.MOEDA === 'EUR'
          ? item.FUP_TAXA_EURO_PROCESSO || 6.12
          : item.FUP_TAXA_DOLAR_PROCESSO || 5.65;
    const fobBrl =
      item.FUP_VALOR_MERCADORIA > 0
        ? item.FUP_VALOR_MERCADORIA
        : item.FUP_VALOR_FOB_REAIS_PROCESSO > 0
          ? item.FUP_VALOR_FOB_REAIS_PROCESSO
          : item.VALOR_LIQUIDO * fx;

    if (item.FUP_ATO_CONCESSORIO) {
      drawbackFobBrl += fobBrl;
    } else {
      fullTaxFobBrl += fobBrl;
    }

    const pepCode = item.ELEMENTO_PEP_INTERNO || 'GERAL';
    const pepDesc = item.DESCRICAO_ELEMENTO_PEP || pepCode;
    const entry = pepMap.get(pepCode) || {
      pepCode,
      pepLabel: pepDesc.length > 22 ? pepDesc.slice(0, 22) : pepDesc,
      drawbackBrl: 0,
      fullTaxBrl: 0,
      orderedQty: 0,
      receivedQty: 0,
    };

    if (item.FUP_ATO_CONCESSORIO) {
      entry.drawbackBrl += fobBrl;
    } else {
      entry.fullTaxBrl += fobBrl;
    }
    entry.orderedQty += Math.max(0, item.QUANTIDADE_PEDIDA);
    entry.receivedQty += Math.max(0, item.QUANTIDADE_RECEBIDA_LIQUIDA);
    pepMap.set(pepCode, entry);
  }

  drawbackFobBrl = round2(drawbackFobBrl);
  fullTaxFobBrl = round2(fullTaxFobBrl);
  const totalFobAll = drawbackFobBrl + fullTaxFobBrl;
  const drawbackCoveragePct =
    totalFobAll > 0 ? round1((drawbackFobBrl / totalFobAll) * 100) : 0;

  const pepProjectsChart = Array.from(pepMap.values())
    .map((p) => {
      const dbk = round2(p.drawbackBrl);
      const full = round2(p.fullTaxBrl);
      return {
        pepCode: p.pepCode,
        pepLabel: p.pepLabel,
        drawbackBrl: dbk,
        fullTaxBrl: full,
        totalFobBrl: round2(dbk + full),
        receivedPct:
          p.orderedQty > 0 ? round1((p.receivedQty / p.orderedQty) * 100) : 0,
      };
    })
    .sort((a, b) => b.totalFobBrl - a.totalFobBrl);

  // Team Results (Comex Analysts + Purchasing Buyers)
  const teamMap = new Map<
    string,
    {
      memberName: string;
      roleKey: 'ANALYST' | 'BUYER';
      refs: Set<string>;
      onTimeCount: number;
      delayedCount: number;
      fobBrl: number;
    }
  >();

  for (const p of processes) {
    const analyst = (p.resp || 'COMEX').trim();
    const key = `ANALYST::${analyst}`;
    const entry = teamMap.get(key) || {
      memberName: analyst,
      roleKey: 'ANALYST' as const,
      refs: new Set<string>(),
      onTimeCount: 0,
      delayedCount: 0,
      fobBrl: 0,
    };
    entry.refs.add(p.ref);
    const hasDelay = p.items.some(
      (i) => i.STATUS_PRAZO_ENTREGA === 'ATRASADO' || i.DIAS_ATRASO_ENTREGA > 0
    );
    if (hasDelay) entry.delayedCount += 1;
    else entry.onTimeCount += 1;
    entry.fobBrl += p.brlFob;
    teamMap.set(key, entry);
  }

  for (const item of nonDeleted) {
    const buyer = (item.NOME_COMPRADOR || '').trim();
    if (!buyer) continue;
    const key = `BUYER::${buyer}`;
    const entry = teamMap.get(key) || {
      memberName: buyer,
      roleKey: 'BUYER' as const,
      refs: new Set<string>(),
      onTimeCount: 0,
      delayedCount: 0,
      fobBrl: 0,
    };
    entry.refs.add(item.PEDIDO || item.id);
    const isDelayed =
      item.STATUS_PRAZO_ENTREGA === 'ATRASADO' || item.DIAS_ATRASO_ENTREGA > 0;
    if (isDelayed) entry.delayedCount += 1;
    else entry.onTimeCount += 1;

    const fx =
      item.MOEDA === 'BRL'
        ? 1
        : item.MOEDA === 'EUR'
          ? item.FUP_TAXA_EURO_PROCESSO || 6.12
          : item.FUP_TAXA_DOLAR_PROCESSO || 5.65;
    const fobBrl =
      item.FUP_VALOR_MERCADORIA > 0
        ? item.FUP_VALOR_MERCADORIA
        : item.FUP_VALOR_FOB_REAIS_PROCESSO > 0
          ? item.FUP_VALOR_FOB_REAIS_PROCESSO
          : item.VALOR_LIQUIDO * fx;
    entry.fobBrl += fobBrl;
    teamMap.set(key, entry);
  }

  const teamResultsChart = Array.from(teamMap.values())
    .map((m) => {
      const total = m.onTimeCount + m.delayedCount;
      return {
        memberName: m.memberName,
        roleKey: m.roleKey,
        processOrPoCount: m.refs.size,
        onTimeCount: m.onTimeCount,
        delayedCount: m.delayedCount,
        fobBrl: round2(m.fobBrl),
        onTimePct: total > 0 ? round1((m.onTimeCount / total) * 100) : 100,
      };
    })
    .sort((a, b) => b.fobBrl - a.fobBrl);

  return {
    totals: {
      totalShipments,
      totalPoCount,
      totalItemLines,
      registeredDiCount,
      total20Cntr,
      total40Cntr,
      totalContainers,
      totalTeus,
      seaShipments,
      airShipments,
      roadShipments,
      totalIntlFreightBrl,
      totalNationalFreightBrl,
      totalFreightBrl,
      freightPctOfFob,
      totalTaxesBrl,
      iiBrl,
      ipiBrl,
      pisBrl,
      cofinsBrl,
      icmsBrl,
      siscomexBrl,
      afrmmBrl,
      totalDelayDays,
      delayedPoCount,
      delayedLineCount,
      avgDelayDays,
      maxDelayDays,
      onTimeRatePct,
      avgClearanceDays,
      clearedProcessCount,
      avgNfTurnaroundDays,
      nfIssuedCount,
      nfPendingCount,
      avgTransitDays,
      avgLeadTimeDays,
      avgStorageDays,
      totalStoragePeriods,
      totalStorageCostBrl,
      totalInvoicesBrl,
      totalShippedFobBrl,
      totalOpenPoBrl,
      drawbackFobBrl,
      fullTaxFobBrl,
      drawbackCoveragePct,
    },
    shipmentsByStage,
    customsChannels,
    containerMix,
    containersByProcess,
    freightByProcess,
    taxByType,
    taxByProcess,
    delaysByStatus,
    delaysByPo,
    clearanceByProcess,
    nfByProcess,
    nfStatusSummary,
    deliveryByProcess,
    storageByProcess,
    invoicesByProcess,
    invoicesByFinancialStatus,
    pepProjectsChart,
    teamResultsChart,
  };
}







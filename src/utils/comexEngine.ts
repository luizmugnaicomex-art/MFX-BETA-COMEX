import type {
  CashFlowEntry,
  ComexFilters,
  FupItemRow,
  MatrixColumnMeta,
  MatrixMaterialRow,
  MatrixProjectSection,
  OrderStatusMatrixData,
  PartnerScorecard,
  ShipmentOperationalStatus,
  ShipmentOverrides,
  ShipmentProcessRow,
  SwotData,
} from '../types/comex';
import { daysBetween, formatDateBr } from './sapParser';

// NCM prefixes typically eligible/linked to Drawback Suspensão in MFX operations
const DRAWBACK_COMMON_NCM_PREFIXES = ['7304', '7306', '3917', '8544', '8481', '7307', '4009', '7411', '7608'];

export function isDrawbackExpectedNcm(ncm: string): boolean {
  const clean = (ncm || '').replace(/\D/g, '');
  return DRAWBACK_COMMON_NCM_PREFIXES.some((p) => clean.startsWith(p));
}

export function filterFupItems(items: FupItemRow[], filters: ComexFilters): FupItemRow[] {
  const q = filters.search.trim().toLowerCase();

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
      } else if (item.FUP_ATO_CONCESSORIO !== filters.atoConcessorio) {
        return false;
      }
    }
    if (filters.supplier && item.NOME_FORNECEDOR !== filters.supplier) return false;
    if (filters.ncm && item.FUP_NCMS !== filters.ncm) return false;
    if (filters.buyer && item.NOME_COMPRADOR !== filters.buyer) return false;
    if (filters.status && item.STATUS_PRAZO_ENTREGA !== filters.status) return false;

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
    const fobBrl =
      item.FUP_VALOR_FOB_REAIS_PROCESSO > 0
        ? item.FUP_VALOR_FOB_REAIS_PROCESSO
        : item.VALOR_LIQUIDO * (item.MOEDA === 'EUR' ? item.FUP_TAXA_EURO_PROCESSO || 6.1 : item.FUP_TAXA_DOLAR_PROCESSO || 5.65);
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
    curr.openQty += item.QUANTIDADE_PENDENTE;
    curr.totalValue += item.VALOR_LIQUIDO;
    if (item.FUP_ATO_CONCESSORIO) {
      curr.hasDrawbackCount += 1;
      curr.acNumbers.add(item.FUP_ATO_CONCESSORIO);
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
    entry.totalValueBrl +=
      item.FUP_VALOR_FOB_REAIS_PROCESSO > 0
        ? item.FUP_VALOR_FOB_REAIS_PROCESSO
        : item.VALOR_LIQUIDO * (item.MOEDA === 'EUR' ? item.FUP_TAXA_EURO_PROCESSO || 6.1 : item.FUP_TAXA_DOLAR_PROCESSO || 5.65);

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
    const procJson = primary.processos[0] || {};
    const ov = overridesMap[ref] || {};

    const poList = Array.from(new Set(groupItems.map((i) => i.PEDIDO).filter(Boolean))).join(', ');
    const acList = Array.from(new Set(groupItems.map((i) => i.FUP_ATO_CONCESSORIO).filter(Boolean))).join(', ');
    const linha = Array.from(new Set(groupItems.map((i) => i.DESCRICAO_ELEMENTO_PEP).filter(Boolean))).join(' / ');
    const miroList = Array.from(new Set(groupItems.map((i) => i.FUP_DOCUMENTOS_MIRO).filter(Boolean))).join(', ');
    const paidList = Array.from(new Set(groupItems.map((i) => i.FUP_DOCUMENTOS_COMPENSACAO).filter(Boolean))).join(', ');

    const currency = primary.MOEDA || 'USD';
    const ptax =
      currency === 'EUR'
        ? primary.FUP_TAXA_EURO_PROCESSO || 6.12
        : primary.FUP_TAXA_DOLAR_PROCESSO || 5.65;

    const invoiceValue = groupItems.reduce((s, i) => s + i.VALOR_LIQUIDO, 0);
    const brlFobSum = groupItems.reduce((s, i) => s + i.FUP_VALOR_FOB_REAIS_PROCESSO, 0);
    const brlFob = brlFobSum > 0 ? brlFobSum : invoiceValue * ptax;
    const usdFob = currency === 'USD' ? invoiceValue : brlFob / (primary.FUP_TAXA_DOLAR_PROCESSO || 5.65);

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

    const trucking = ov.truckingCost ?? procJson.FRETE_NACIONAL ?? (recebimento ? 3850 : 0);
    const brokerFee = ov.brokerFee ?? procJson.BROKER_FEE ?? (primary.NUM_DI ? 1950 : 0);
    const liFee = ov.liFee ?? procJson.LI_FEE ?? (acList ? 480 : 0);
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
      c20: procJson.CONTAINERS_20 ?? (procJson.TIPO_CONTEINER?.includes('20') ? 1 : 0),
      c40: procJson.CONTAINERS_40 ?? (procJson.TIPO_CONTEINER?.includes('40') ? 1 : 0),
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
      nfStatus: ov.nfStatus || (procJson.NFENUM ? 'EMITIDA' : '-'),
      nfNum: procJson.NFENUM || '-',
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
  overridesMap: Record<string, ShipmentOverrides>
): OrderStatusMatrixData {
  const colMap = new Map<string, MatrixColumnMeta>();

  for (const item of items) {
    const isBl = Boolean(item.ULTIMO_PROCESSO_IMPORTACAO);
    const key = isBl ? `BL:${item.ULTIMO_PROCESSO_IMPORTACAO}` : `PO:${item.PEDIDO}`;
    const number = isBl ? item.ULTIMO_PROCESSO_IMPORTACAO : item.PEDIDO;
    if (!number) continue;

    const existing = colMap.get(key);
    const ov = isBl ? overridesMap[number] : overridesMap[item.PEDIDO];
    const paymentStr = ov?.paymentDate || formatDateBr(item.DATA_ULTIMA_MIRO);
    const etdStr = formatDateBr(item.ETD || item.DATA_PROGRAMACAO_FORNECIMENTO);
    const etaStr = formatDateBr(item.ETA || item.DATA_ENTREGA_PREVISTA);

    if (!existing) {
      colMap.set(key, {
        key,
        kind: isBl ? 'BL' : 'PO',
        number,
        supplier: item.NOME_FORNECEDOR || '-',
        payment: paymentStr,
        advValue: item.VALOR_LIQUIDO,
        currency: item.MOEDA || 'USD',
        etd: etdStr,
        eta: etaStr,
      });
    } else {
      existing.advValue += item.VALOR_LIQUIDO;
      if (existing.payment === '-' && paymentStr !== '-') existing.payment = paymentStr;
      if (existing.etd === '-' && etdStr !== '-') existing.etd = etdStr;
      if (existing.eta === '-' && etaStr !== '-') existing.eta = etaStr;
    }
  }

  // Sort POs first, then BLs
  const columns = Array.from(colMap.values()).sort((a, b) => {
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
        quantities: {},
        qtdAcDefault: 0,
        acNumber: item.FUP_ATO_CONCESSORIO,
      };
      section.materialsMap.set(matKey, matRow);
    }

    const isBl = Boolean(item.ULTIMO_PROCESSO_IMPORTACAO);
    const colKey = isBl ? `BL:${item.ULTIMO_PROCESSO_IMPORTACAO}` : `PO:${item.PEDIDO}`;
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

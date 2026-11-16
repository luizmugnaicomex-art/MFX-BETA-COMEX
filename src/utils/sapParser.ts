import * as XLSX from 'xlsx';
import type {
  DeliveryStatus,
  FaturaJson,
  FinanceiroJson,
  FiscalDetailJson,
  FupItemRow,
  ModalType,
  ParametrizationChannel,
  ProcessDetailJson,
} from '../types/comex';

export function stripLeadingZeros(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (!str) return '';
  const stripped = str.replace(/^0+/, '');
  return stripped || '0';
}

export function formatAtoConcessorio(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value === 0) return '';
    return Math.trunc(value).toString();
  }
  const raw = String(value).trim();
  if (!raw) return '';

  const tokens = raw
    .split(/[,;/]+/)
    .map((part) => {
      let str = part.trim();
      if (!str || str === '-') return '';
      // Handle scientific notation like "2.024002415E10" or trailing ".0"
      if (/^\d+(\.\d+)?[eE][+-]?\d+$/.test(str)) {
        const num = Number(str);
        str = Number.isFinite(num) ? Math.trunc(num).toString() : str;
      } else {
        str = str.replace(/\.0+$/, '');
      }
      if (/^0+$/.test(str)) return '';
      if (/^\d+$/.test(str)) {
        return str.replace(/^0+/, '');
      }
      return str;
    })
    .filter(Boolean);

  return Array.from(new Set(tokens)).join(', ');
}

export function normalizeNcmList(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  const tokens = raw
    .split(/[,;/]+/)
    .map((part) => part.trim())
    .filter((part) => {
      if (!part || part === '-' || part.toUpperCase() === 'SEM NCM') return false;
      if (/^0+([.\s]0+)*$/.test(part)) return false;
      return true;
    });

  return Array.from(new Set(tokens)).join(', ');
}

export function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw !== 'string') {
    if (Array.isArray(raw) || typeof raw === 'object') {
      return raw as T;
    }
    return fallback;
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '[]' || trimmed === '{}' || trimmed === 'null') {
    return fallback;
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return fallback;
  }
}

export function parseNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let str = String(value).trim();
  if (!str) return 0;
  // Remove currency symbols or spaces
  str = str.replace(/[R$€USD\s]/gi, '');
  // Handle pt-BR format like 1.234,56 vs en-US 1,234.56
  if (/^\-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (/^\-?\d+,\d+$/.test(str)) {
    str = str.replace(',', '.');
  } else {
    str = str.replace(/,/g, '');
  }
  const n = Number(str);
  return Number.isFinite(n) ? n : 0;
}

export function parseExcelDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && value > 20000 && value < 70000) {
    // Excel serial date (days since 1899-12-30)
    const utcDays = Math.floor(value - 25569);
    const utcMs = utcDays * 86400 * 1000;
    const d = new Date(utcMs);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  const str = String(value).trim();
  if (!str || str === '0000-00-00' || str === '00/00/0000') return '';

  // ISO YYYY-MM-DD or YYYY-MM-DDTHH:mm...
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // DD/MM/YYYY or DD.MM.YYYY
  const brMatch = str.match(/^(\d{2})[\/.](\d{2})[\/.](\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  // YYYYMMDD
  const sapMatch = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (sapMatch) {
    return `${sapMatch[1]}-${sapMatch[2]}-${sapMatch[3]}`;
  }

  return '';
}

export function formatDateBr(isoDate: string | undefined | null): string {
  if (!isoDate) return '-';
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return isoDate;
}

export function daysBetween(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 0;
  const s = new Date(`${startIso}T00:00:00Z`).getTime();
  const e = new Date(`${endIso}T00:00:00Z`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.round((e - s) / 86400000);
}

export function formatCurrency(value: number, currency = 'BRL'): string {
  const safeVal = Number.isFinite(value) ? value : 0;
  const curr = (currency || 'BRL').toUpperCase();
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: curr === 'USD' || curr === 'EUR' || curr === 'BRL' ? curr : 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeVal);
  } catch {
    return `${curr} ${safeVal.toFixed(2)}`;
  }
}

export function formatNumber(value: number, decimals = 2): string {
  const safeVal = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safeVal);
}

function pickDefined(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (key in row && row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
    const lower = key.trim().toLowerCase();
    for (const rKey of Object.keys(row)) {
      if (
        rKey.trim().toLowerCase() === lower &&
        row[rKey] !== undefined &&
        row[rKey] !== null &&
        row[rKey] !== ''
      ) {
        return row[rKey];
      }
    }
  }
  return undefined;
}

function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  const val = pickDefined(row, ...keys);
  return val === undefined ? '' : val;
}

function normalizeChannel(val: unknown): ParametrizationChannel {
  const s = String(val || '').trim().toUpperCase();
  if (s === 'VD' || s.startsWith('VERD')) return 'VD';
  if (s === 'AM' || s.startsWith('AMAR')) return 'AM';
  if (s === 'VM' || s.startsWith('VERM')) return 'VM';
  if (s === 'CZ' || s.startsWith('CINZ')) return 'CZ';
  return '';
}

function normalizeModal(val: unknown): ModalType {
  const s = String(val || '').trim().toUpperCase();
  if (s === 'M' || s.startsWith('MAR')) return 'M';
  if (s === 'A' || s.startsWith('AER') || s.startsWith('AÉR')) return 'A';
  if (s === 'R' || s.startsWith('ROD')) return 'R';
  return '';
}

function normalizeDeliveryStatus(
  statusRaw: unknown,
  loekz: string,
  statusItemSap: string,
  delayDays: number,
  pendingQty: number
): DeliveryStatus {
  const s = String(statusRaw || '').trim().toUpperCase();
  if (loekz === 'L' || s.includes('EXCLUIDO') || statusItemSap.toUpperCase().includes('EXCLUIDO')) {
    return 'ITEM EXCLUIDO';
  }
  if (s.includes('CONCLUIDA') || (pendingQty <= 0 && !s.includes('ATRAS'))) {
    return 'ENTREGA CONCLUIDA SAP';
  }
  if (s.includes('ATRAS') || delayDays > 0) {
    return 'ATRASADO';
  }
  return 'NO PRAZO';
}

export function normalizeFupRow(raw: Record<string, unknown>, index: number): FupItemRow {
  const rawProcStr = String(pick(raw, 'PROCESSOS_JSON') || '[]');
  const rawFiscalStr = String(pick(raw, 'DETALHES_FISCAIS_JSON') || '[]');
  const rawFaturasStr = String(pick(raw, 'FATURAS_JSON') || '[]');
  const rawFinStr = String(pick(raw, 'FINANCEIRO_JSON') || '[]');
  const rawCompStr = String(pick(raw, 'COMPLEMENTO_JSON', 'HISTORICO_JSON', 'ESTOQUE_JSON') || '{}');

  const processos = safeJsonParse<ProcessDetailJson[]>(rawProcStr, []);
  const detalhesFiscais = safeJsonParse<FiscalDetailJson[]>(rawFiscalStr, []);
  const faturas = safeJsonParse<FaturaJson[]>(rawFaturasStr, []);
  const financeiro = safeJsonParse<FinanceiroJson[]>(rawFinStr, []);

  const firstProc: ProcessDetailJson = Array.isArray(processos) && processos[0] ? processos[0] : {};
  const firstFiscal: FiscalDetailJson = Array.isArray(detalhesFiscais) && detalhesFiscais[0] ? detalhesFiscais[0] : {};

  const pedido = String(pick(raw, 'PEDIDO', 'EBELN') || '').trim();
  const itemPedido = stripLeadingZeros(pick(raw, 'ITEM_PEDIDO', 'EBELP') || '10').padStart(5, '0');
  const loekz = String(pick(raw, 'LOEKZ') || '').trim().toUpperCase();
  const statusItemSap = String(pick(raw, 'STATUS_ITEM_SAP') || (loekz === 'L' ? 'ITEM EXCLUIDO' : 'ATIVO')).trim();

  const qtdPedida = parseNumber(pick(raw, 'QUANTIDADE_PEDIDA', 'MENGE'));
  const qtdRecebida = parseNumber(pick(raw, 'QUANTIDADE_RECEBIDA_LIQUIDA', 'WEMNG'));
  const qtdPendenteRaw = pick(raw, 'QUANTIDADE_PENDENTE', 'QUANTIDADE_PENDENTE_EKET');
  const qtdPendente =
    qtdPendenteRaw !== '' ? parseNumber(qtdPendenteRaw) : Math.max(0, qtdPedida - qtdRecebida);
  const pctRecRaw = pick(raw, 'PERCENTUAL_RECEBIMENTO');
  const pctRec =
    pctRecRaw !== ''
      ? parseNumber(pctRecRaw)
      : qtdPedida > 0
        ? Math.min(100, Math.round((qtdRecebida / qtdPedida) * 1000) / 10)
        : 0;

  const diasAtraso = parseNumber(pick(raw, 'DIAS_ATRASO_ENTREGA'));
  const statusPrazo = normalizeDeliveryStatus(
    pick(raw, 'STATUS_PRAZO_ENTREGA'),
    loekz,
    statusItemSap,
    diasAtraso,
    qtdPendente
  );

  const estoqueLivre = parseNumber(pick(raw, 'ESTOQUE_LIVRE_PLANTA_0003'));
  const estoqueQual = parseNumber(pick(raw, 'ESTOQUE_QUALIDADE_PLANTA_0003'));
  const estoqueBloq = parseNumber(pick(raw, 'ESTOQUE_BLOQUEADO_PLANTA_0003'));
  const estoqueSomaRaw = pick(raw, 'ESTOQUE_SOMA_TRES_CATEGORIAS_PLANTA_0003');
  const estoqueSoma =
    estoqueSomaRaw !== '' ? parseNumber(estoqueSomaRaw) : estoqueLivre + estoqueQual + estoqueBloq;

  const acRaw = pick(raw, 'FUP_ATO_CONCESSORIO') || firstProc.NUM_ATO_CONCESS || '';
  const ultimoProc = String(
    pick(raw, 'ULTIMO_PROCESSO_IMPORTACAO', 'FUP_ULTIMO_PROCESSO', 'FUP_NUMEROS_PROCESSOS') ||
      firstProc.NUM_PROCESSO ||
      ''
  ).trim();

  const sumFiscalJson = (getter: (f: FiscalDetailJson) => unknown): number => {
    if (!Array.isArray(detalhesFiscais) || detalhesFiscais.length === 0) return 0;
    return detalhesFiscais.reduce((sum, entry) => sum + parseNumber(getter(entry)), 0);
  };

  const rawVa = pickDefined(raw, 'FUP_VALOR_ADUANEIRO');
  const rawIi = pickDefined(raw, 'FUP_TOTAL_II_ITEM');
  const rawIpi = pickDefined(raw, 'FUP_TOTAL_IPI_ITEM');
  const rawPis = pickDefined(raw, 'FUP_TOTAL_PIS_ITEM');
  const rawCofins = pickDefined(raw, 'FUP_TOTAL_COFINS_ITEM');
  const rawIcms = pickDefined(raw, 'FUP_TOTAL_ICMS_ITEM');
  const rawSiscomex = pickDefined(raw, 'FUP_TOTAL_SISCOMEX_ITEM');
  const rawFreteFiscal = pickDefined(raw, 'FUP_TOTAL_FRETE_FISCAL_ITEM');
  const rawSeguroFiscal = pickDefined(raw, 'FUP_TOTAL_SEGURO_FISCAL_ITEM');

  const hasExplicitSapTaxes =
    rawIi !== undefined ||
    rawIpi !== undefined ||
    rawPis !== undefined ||
    rawCofins !== undefined ||
    rawIcms !== undefined ||
    (Array.isArray(detalhesFiscais) && detalhesFiscais.length > 0);

  return {
    id: `${pedido || 'ROW'}-${itemPedido}-${index}`,
    PEDIDO: pedido,
    ITEM_PEDIDO: itemPedido,
    BSART: String(pick(raw, 'BSART') || 'ZIMP').trim(),
    DATA_PEDIDO: parseExcelDate(pick(raw, 'DATA_PEDIDO', 'BEDAT')),
    FORNECEDOR: stripLeadingZeros(pick(raw, 'FORNECEDOR', 'LIFNR')),
    NOME_FORNECEDOR: String(pick(raw, 'NOME_FORNECEDOR', 'NAME1') || '').trim(),
    NOME_COMPRADOR: String(pick(raw, 'NOME_COMPRADOR', 'EKNAM') || '').trim(),
    MATERIAL: stripLeadingZeros(pick(raw, 'MATERIAL', 'MATNR')),
    DESCRICAO_MATERIAL: String(pick(raw, 'DESCRICAO_MATERIAL', 'TXZ01') || '').trim(),
    DESCRICAO_MATERIAL_INGLES: String(pick(raw, 'DESCRICAO_MATERIAL_INGLES') || '').trim(),
    FUP_NCMS: normalizeNcmList(pick(raw, 'FUP_NCMS', 'NCM') || firstFiscal.NCM || ''),
    UNIDADE: String(pick(raw, 'UNIDADE', 'MEINS') || 'UND').trim(),
    MOEDA: String(pick(raw, 'MOEDA', 'WAERS') || 'USD').trim().toUpperCase(),
    PRECO_UNITARIO: parseNumber(pick(raw, 'PRECO_UNITARIO', 'NETPR')),
    VALOR_LIQUIDO: parseNumber(pick(raw, 'VALOR_LIQUIDO', 'NETWR')),

    QUANTIDADE_PEDIDA: qtdPedida,
    QUANTIDADE_RECEBIDA_LIQUIDA: qtdRecebida,
    QUANTIDADE_PENDENTE: qtdPendente,
    PERCENTUAL_RECEBIMENTO: pctRec,
    DATA_PROGRAMACAO_FORNECIMENTO: parseExcelDate(pick(raw, 'DATA_PROGRAMACAO_FORNECIMENTO')),
    DATA_ENTREGA_PREVISTA: parseExcelDate(pick(raw, 'DATA_ENTREGA_PREVISTA', 'EINDT')),
    ULTIMA_DATA_RECEBIMENTO: parseExcelDate(pick(raw, 'ULTIMA_DATA_RECEBIMENTO')),
    DIAS_ATRASO_ENTREGA: diasAtraso,
    STATUS_PRAZO_ENTREGA: statusPrazo,
    STATUS_ITEM_SAP: statusItemSap,
    LOEKZ: loekz || (statusPrazo === 'ITEM EXCLUIDO' ? 'L' : ''),
    STATUS_MIGO: String(pick(raw, 'STATUS_MIGO') || (qtdRecebida > 0 ? 'CONCLUIDO' : 'PENDENTE')).trim(),
    STATUS_MIRO: String(pick(raw, 'STATUS_MIRO') || (faturas.length > 0 ? 'LANCADA' : 'PENDENTE')).trim(),
    ESTOQUE_LIVRE_PLANTA_0003: estoqueLivre,
    ESTOQUE_QUALIDADE_PLANTA_0003: estoqueQual,
    ESTOQUE_BLOQUEADO_PLANTA_0003: estoqueBloq,
    ESTOQUE_SOMA_TRES_CATEGORIAS_PLANTA_0003: estoqueSoma,

    ELEMENTO_PEP_INTERNO: String(pick(raw, 'ELEMENTO_PEP_INTERNO', 'PS_PSP_PNR') || '').trim(),
    DESCRICAO_ELEMENTO_PEP: String(pick(raw, 'DESCRICAO_ELEMENTO_PEP') || '').trim(),
    FUP_ATO_CONCESSORIO: formatAtoConcessorio(acRaw),

    ULTIMO_PROCESSO_IMPORTACAO: ultimoProc,
    FUP_NUMEROS_PROCESSOS: String(pick(raw, 'FUP_NUMEROS_PROCESSOS') || ultimoProc).trim(),
    NUM_DI: String(pick(raw, 'NUM_DI', 'FUP_DI_ULTIMO_PROCESSO') || '').trim(),
    DATA_DI: parseExcelDate(pick(raw, 'DATA_DI')),
    FUP_CANAL_PARAMETRIZACAO: normalizeChannel(pick(raw, 'FUP_CANAL_PARAMETRIZACAO')),
    FUP_QUANTIDADE_DI: parseNumber(pick(raw, 'FUP_QUANTIDADE_DI')),
    CONHECIMENTO_EMBARQUE: String(pick(raw, 'CONHECIMENTO_EMBARQUE') || '').trim(),
    FUP_INCOTERM: String(pick(raw, 'FUP_INCOTERM', 'INCO1') || '').trim().toUpperCase(),
    FUP_TIPO_EMBARQUE: normalizeModal(pick(raw, 'FUP_TIPO_EMBARQUE')),
    ETD: parseExcelDate(pick(raw, 'ETD', 'FUP_ETD_ULTIMO_PROCESSO')),
    ETA: parseExcelDate(pick(raw, 'ETA', 'FUP_ETA_ULTIMO_PROCESSO')),
    FUP_DATA_PRESENCA_CARGA: parseExcelDate(pick(raw, 'FUP_DATA_PRESENCA_CARGA')),
    DATA_DESEMBARACO: parseExcelDate(pick(raw, 'DATA_DESEMBARACO')),
    DATA_ENTREGA_MFX: parseExcelDate(pick(raw, 'DATA_ENTREGA_MFX')),

    FUP_VALOR_ADUANEIRO:
      rawVa !== undefined ? parseNumber(rawVa) : sumFiscalJson((f) => f.VALOR_ADUANEIRO),
    FUP_VALOR_MERCADORIA: parseNumber(pick(raw, 'FUP_VALOR_MERCADORIA')),
    FUP_VALOR_FOB_REAIS_PROCESSO: parseNumber(pick(raw, 'FUP_VALOR_FOB_REAIS_PROCESSO')),
    FUP_TAXA_DOLAR_PROCESSO: parseNumber(pick(raw, 'FUP_TAXA_DOLAR_PROCESSO')),
    FUP_TAXA_EURO_PROCESSO: parseNumber(pick(raw, 'FUP_TAXA_EURO_PROCESSO')),
    FUP_TOTAL_II_ITEM: rawIi !== undefined ? parseNumber(rawIi) : sumFiscalJson((f) => f.II),
    FUP_TOTAL_IPI_ITEM: rawIpi !== undefined ? parseNumber(rawIpi) : sumFiscalJson((f) => f.IPI),
    FUP_TOTAL_PIS_ITEM: rawPis !== undefined ? parseNumber(rawPis) : sumFiscalJson((f) => f.PIS),
    FUP_TOTAL_COFINS_ITEM:
      rawCofins !== undefined ? parseNumber(rawCofins) : sumFiscalJson((f) => f.COFINS),
    FUP_TOTAL_ICMS_ITEM: rawIcms !== undefined ? parseNumber(rawIcms) : sumFiscalJson((f) => f.ICMS),
    FUP_TOTAL_SISCOMEX_ITEM:
      rawSiscomex !== undefined ? parseNumber(rawSiscomex) : sumFiscalJson((f) => f.SISCOMEX),
    FUP_TOTAL_FRETE_FISCAL_ITEM:
      rawFreteFiscal !== undefined
        ? parseNumber(rawFreteFiscal)
        : sumFiscalJson((f) => f.FRETE_FISCAL),
    FUP_TOTAL_SEGURO_FISCAL_ITEM:
      rawSeguroFiscal !== undefined
        ? parseNumber(rawSeguroFiscal)
        : sumFiscalJson((f) => f.SEGURO_FISCAL),
    FUP_ARMAZENAGEM_PROCESSO: parseNumber(pick(raw, 'FUP_ARMAZENAGEM_PROCESSO')),
    FUP_AFRMM_PROCESSO: parseNumber(pick(raw, 'FUP_AFRMM_PROCESSO')),
    FUP_CAPATAZIA_PROCESSO: parseNumber(pick(raw, 'FUP_CAPATAZIA_PROCESSO')),
    hasExplicitSapTaxes,
    FUP_DOCUMENTOS_MIRO: String(
      pick(raw, 'FUP_DOCUMENTOS_MIRO') || faturas.map((f) => f.MIRO_BELNR).filter(Boolean).join(', ')
    ).trim(),
    DATA_ULTIMA_MIRO: parseExcelDate(pick(raw, 'DATA_ULTIMA_MIRO') || faturas[0]?.BUDAT || faturas[0]?.BLDAT),
    FUP_DOCUMENTOS_FI: String(
      pick(raw, 'FUP_DOCUMENTOS_FI') || financeiro.map((f) => f.FI_BELNR).filter(Boolean).join(', ')
    ).trim(),
    FUP_DOCUMENTOS_COMPENSACAO: String(
      pick(raw, 'FUP_DOCUMENTOS_COMPENSACAO') || financeiro.map((f) => f.AUGBL).filter(Boolean).join(', ')
    ).trim(),
    FUP_STATUS_FINANCEIRO_ATIVAS: String(pick(raw, 'FUP_STATUS_FINANCEIRO_ATIVAS') || '').trim(),
    FUP_QTD_MIRO_VENCIDAS: parseNumber(pick(raw, 'FUP_QTD_MIRO_VENCIDAS')),
    FUP_QTD_MIRO_A_VENCER: parseNumber(pick(raw, 'FUP_QTD_MIRO_A_VENCER')),

    processos: Array.isArray(processos) ? processos : [],
    detalhesFiscais: Array.isArray(detalhesFiscais) ? detalhesFiscais : [],
    faturas: Array.isArray(faturas) ? faturas : [],
    financeiro: Array.isArray(financeiro) ? financeiro : [],
    rawJsonStrings: {
      PROCESSOS_JSON: rawProcStr,
      DETALHES_FISCAIS_JSON: rawFiscalStr,
      FATURAS_JSON: rawFaturasStr,
      FINANCEIRO_JSON: rawFinStr,
      COMPLEMENTO_JSON: rawCompStr,
    },
  };
}

export function parseFupWorkbook(buffer: ArrayBuffer): {
  items: FupItemRow[];
  sheetName: string;
} {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const targetSheetName =
    wb.SheetNames.find((name) => name.toLowerCase().trim() === 'comex fup') ||
    wb.SheetNames.find((name) => name.toLowerCase().includes('fup')) ||
    wb.SheetNames[0];

  if (!targetSheetName) {
    throw new Error('No worksheets found in the uploaded Excel file.');
  }

  const sheet = wb.Sheets[targetSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const items = rawRows
    .filter((row) => Object.values(row).some((v) => v !== '' && v !== null && v !== undefined))
    .map((row, idx) => normalizeFupRow(row, idx));

  return { items, sheetName: targetSheetName };
}

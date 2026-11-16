export type ParametrizationChannel = 'VD' | 'AM' | 'VM' | 'CZ' | '';
export type ModalType = 'M' | 'A' | 'R' | '';
export type DeliveryStatus =
  | 'NO PRAZO'
  | 'ATRASADO'
  | 'ENTREGA CONCLUIDA SAP'
  | 'ITEM EXCLUIDO';

export interface ProcessDetailJson {
  NUM_PROCESSO?: string;
  NUM_ATO_CONCESS?: string;
  PORTO_EMBRAQUE?: string;
  PORTO_DESTINO?: string;
  AGENTE?: string;
  ARMADOR?: string;
  DESPACHANTE?: string;
  TERMINAL_ATRAC?: string;
  NAVIO_NUM_VOO?: string;
  INV_DO_EXPORTADOR?: string;
  TIPO_CONTEINER?: string;
  LACRE?: string;
  FREE_TIME_DEMURRAGE?: number;
  DT_VENC_FREE_TIME_DEMURRAGE?: string;
  DT_DEVOL_CONTAINER?: string;
  TRANSIT_TIME_ATUALIZADO?: number;
  LEAD_TIME_ENTREGA?: number;
  NFENUM?: string;
  TRANSP_DI?: string;
  DATA_SOL_NUMERARIO?: string;
  VALOR_ADT?: number;
  NUM_MASTER?: string;
  CONTAINERS_20?: number;
  CONTAINERS_40?: number;
  REGIME_TRIBUTARIO?: string;
  AC_SUB?: string;
  ANALYST?: string;
  TRACKING_NUM?: string;
  TRANSSHIPMENT?: string;
  TRANSSHIPMENT_PORT?: string;
  TRANS_ETA?: string;
  TRANS_ETD?: string;
  BERTHING_DATE?: string;
  ECOTAX?: number;
  FRETE_NACIONAL?: number;
  BROKER_FEE?: number;
  LI_FEE?: number;
  DEMURRAGE_COST?: number;
  PI_NUMBER?: string;
}

export interface FiscalDetailJson {
  NCM?: string;
  II?: number;
  IPI?: number;
  PIS?: number;
  COFINS?: number;
  ICMS?: number;
  SISCOMEX?: number;
  VALOR_ADUANEIRO?: number;
  FRETE_FISCAL?: number;
  SEGURO_FISCAL?: number;
  REGIME_TRIBUTARIO?: string;
}

export interface FaturaJson {
  MIRO_BELNR: string;
  XBLNR?: string;
  BLDAT?: string;
  BUDAT?: string;
  RMWWR: number;
  WAERS: string;
  STATUS?: string;
}

export interface FinanceiroJson {
  FI_BELNR: string;
  MIRO_BELNR?: string;
  WRBTR: number;
  WAERS: string;
  ZFBDT?: string;
  NETDT?: string;
  AUGBL?: string;
  AUGDT?: string;
  STATUS?: 'PAGO' | 'A VENCER' | 'VENCIDA';
}

export interface FupItemRow {
  id: string;
  // 1. Order & Material Core
  PEDIDO: string;
  ITEM_PEDIDO: string;
  BSART: string;
  DATA_PEDIDO: string;
  FORNECEDOR: string;
  NOME_FORNECEDOR: string;
  NOME_COMPRADOR: string;
  MATERIAL: string;
  DESCRICAO_MATERIAL: string;
  DESCRICAO_MATERIAL_INGLES: string;
  FUP_NCMS: string;
  UNIDADE: string;
  MOEDA: string;
  PRECO_UNITARIO: number;
  VALOR_LIQUIDO: number;

  // 2. Quantities, Stock & Delivery Schedule
  QUANTIDADE_PEDIDA: number;
  QUANTIDADE_RECEBIDA_LIQUIDA: number;
  QUANTIDADE_PENDENTE: number;
  PERCENTUAL_RECEBIMENTO: number;
  DATA_PROGRAMACAO_FORNECIMENTO: string;
  DATA_ENTREGA_PREVISTA: string;
  ULTIMA_DATA_RECEBIMENTO: string;
  DIAS_ATRASO_ENTREGA: number;
  STATUS_PRAZO_ENTREGA: DeliveryStatus;
  STATUS_ITEM_SAP: string;
  LOEKZ: string;
  STATUS_MIGO: string;
  STATUS_MIRO: string;
  ESTOQUE_LIVRE_PLANTA_0003: number;
  ESTOQUE_QUALIDADE_PLANTA_0003: number;
  ESTOQUE_BLOQUEADO_PLANTA_0003: number;
  ESTOQUE_SOMA_TRES_CATEGORIAS_PLANTA_0003: number;

  // 3. Projects (PEP) & Drawback
  ELEMENTO_PEP_INTERNO: string;
  DESCRICAO_ELEMENTO_PEP: string;
  FUP_ATO_CONCESSORIO: string;

  // 4. Import Process & Customs
  ULTIMO_PROCESSO_IMPORTACAO: string;
  FUP_NUMEROS_PROCESSOS: string;
  NUM_DI: string;
  DATA_DI: string;
  FUP_CANAL_PARAMETRIZACAO: ParametrizationChannel;
  FUP_QUANTIDADE_DI: number;
  CONHECIMENTO_EMBARQUE: string;
  FUP_INCOTERM: string;
  FUP_TIPO_EMBARQUE: ModalType;
  ETD: string;
  ETA: string;
  FUP_DATA_PRESENCA_CARGA: string;
  DATA_DESEMBARACO: string;
  DATA_ENTREGA_MFX: string;

  // 5. Financial, Taxes & MIRO/FI
  FUP_VALOR_ADUANEIRO: number;
  FUP_VALOR_MERCADORIA: number;
  FUP_VALOR_FOB_REAIS_PROCESSO: number;
  FUP_TAXA_DOLAR_PROCESSO: number;
  FUP_TAXA_EURO_PROCESSO: number;
  FUP_TOTAL_II_ITEM: number;
  FUP_TOTAL_IPI_ITEM: number;
  FUP_TOTAL_PIS_ITEM: number;
  FUP_TOTAL_COFINS_ITEM: number;
  FUP_TOTAL_ICMS_ITEM: number;
  FUP_TOTAL_SISCOMEX_ITEM: number;
  FUP_TOTAL_FRETE_FISCAL_ITEM: number;
  FUP_TOTAL_SEGURO_FISCAL_ITEM: number;
  FUP_ARMAZENAGEM_PROCESSO: number;
  FUP_AFRMM_PROCESSO: number;
  FUP_CAPATAZIA_PROCESSO: number;
  FUP_DOCUMENTOS_MIRO: string;
  DATA_ULTIMA_MIRO: string;
  FUP_DOCUMENTOS_FI: string;
  FUP_DOCUMENTOS_COMPENSACAO: string;
  FUP_STATUS_FINANCEIRO_ATIVAS: string;
  FUP_QTD_MIRO_VENCIDAS: number;
  FUP_QTD_MIRO_A_VENCER: number;

  // Decoded JSON payloads
  processos: ProcessDetailJson[];
  detalhesFiscais: FiscalDetailJson[];
  faturas: FaturaJson[];
  financeiro: FinanceiroJson[];
  rawJsonStrings: {
    PROCESSOS_JSON: string;
    DETALHES_FISCAIS_JSON: string;
    FATURAS_JSON: string;
    FINANCEIRO_JSON: string;
    COMPLEMENTO_JSON: string;
  };
}

export type ShipmentOperationalStatus =
  | 'AG. PRONTIDAO DA CARGA'
  | 'EM TRÂNSITO'
  | 'AG. DESEMBARAÇO'
  | 'PARADO AG. DRAWBACK'
  | 'ENTREGUE';

export interface ShipmentOverrides {
  resp?: string;
  pi?: string;
  preAlertDate?: string;
  diDraftDate?: string;
  trackingNum?: string;
  docBrokerDate?: string;
  blBrokerDate?: string;
  origBlStatus?: string;
  invPckStatus?: string;
  regTrib?: string;
  acSub?: string;
  transshipment?: string;
  transshipmentPort?: string;
  transEta?: string;
  transEtd?: string;
  berthingDate?: string;
  numerarioDate?: string;
  valorAdt?: number;
  ecotax?: number;
  espelho?: string;
  minuta?: string;
  nfStatus?: string;
  truckingCost?: number;
  brokerFee?: number;
  liFee?: number;
  demurrageCost?: number;
  devCtnrDate?: string;
  status?: ShipmentOperationalStatus;
  freightCost?: number;
  paymentDate?: string;
}

export interface ShipmentProcessRow {
  ref: string;
  resp: string;
  exporter: string;
  linha: string;
  pi: string;
  poList: string;
  ac: string;
  // PROCESSO (Agente de Carga)
  agenteCarga: string;
  ptax: number;
  freightCost: number;
  brlFrete: number;
  blAwb: string;
  master: string;
  modal: string;
  incoterm: string;
  cntr: string;
  seal: string;
  c20: number;
  c40: number;
  invPck: string;
  origBl: string;
  regTrib: string;
  acSub: string;
  // PRE ALERT + ORIGINAIS (Despachante)
  ie: string;
  broker: string;
  valorPreAlert: number;
  preAlert: string;
  diDraft: string;
  ptaxPreAlert: number;
  invoiceValue: number;
  currency: string;
  miro: string;
  brlInvoice: number;
  paid: string;
  trackingNum: string;
  docBroker: string;
  blBroker: string;
  // EMBARQUE (Agente de Carga)
  fromPort: string;
  etd: string;
  transshipment: string;
  transPort: string;
  transEta: string;
  transEtd: string;
  eta: string;
  etaFactory: string;
  // REGISTRO | DESEMBARAÇO (Despachante)
  berthing: string;
  terminal: string;
  presenca: string;
  numerario: string;
  valorAdt: number;
  registro: string;
  diNum: string;
  ptaxDi: number;
  impostos: number;
  afrmm: number;
  ecotax: number;
  canal: 'VERDE' | 'AMARELO' | 'VERMELHO' | 'CINZA' | '-';
  desCi: string;
  espelho: string;
  minuta: string;
  nfStatus: string;
  nfNum: string;
  transportadora: string;
  freteNac: number;
  recebimento: string;
  // ESTADIA & TIME
  days: number;
  periodos: number;
  armazenagem: number;
  devCtnr: string;
  demurrage: number;
  transitTime: number;
  leadTime: number;
  // CUSTOS | PAGAMENTOS & STATUS
  warehouse: number;
  trucking: number;
  brokerFee: number;
  freightTotal: number;
  liFee: number;
  demurrageTotal: number;
  totalCostBrl: number;
  brlCif: number;
  brlFob: number;
  usdFob: number;
  pctCostCif: number;
  pctCostFob: number;
  status: ShipmentOperationalStatus;
  // Linked items
  items: FupItemRow[];
}

export interface MatrixColumnMeta {
  key: string;
  kind: 'PO' | 'BL';
  number: string;
  supplier: string;
  payment: string;
  advValue: number;
  currency: string;
  etd: string;
  eta: string;
}

export interface MatrixMaterialRow {
  rowKey: string;
  materialCode: string;
  descPt: string;
  descEn: string;
  ncm: string;
  um: string;
  estoque: number;
  quantities: Record<string, number>;
  qtdAcDefault: number;
  acNumber: string;
}

export interface MatrixProjectSection {
  sectionKey: string;
  pepCode: string;
  pepDescription: string;
  label: string;
  materials: MatrixMaterialRow[];
}

export interface OrderStatusMatrixData {
  columns: MatrixColumnMeta[];
  sections: MatrixProjectSection[];
}

export interface CashFlowEntry {
  id: string;
  source: 'MIRO/FI' | 'LOGISTICS' | 'CUSTOMS/TAXES';
  reference: string;
  processRef: string;
  partner: string;
  documentNumber: string;
  issueDate: string;
  dueDate: string;
  clearingDate: string;
  clearingDoc: string;
  amount: number;
  currency: string;
  amountBrl: number;
  status: 'PAGO' | 'A VENCER' | 'VENCIDA' | 'PROJETADO';
  category: string;
}

export type PartnerCategory = 'SUPPLIER' | 'FORWARDER' | 'BROKER';

export interface PartnerScorecard {
  id: string;
  name: string;
  category: PartnerCategory;
  poOrProcessCount: number;
  totalValueUsd: number;
  totalValueBrl: number;
  openQty: number;
  deliveredQty: number;
  onTimeRate: number;
  avgDelayDays: number;
  avgTransitTime: number;
  avgClearanceDays: number;
  storagePeriodIncidence: number;
  airCount: number;
  seaCount: number;
  freightPctOverFob: number;
  drawbackCoverageRate: number;
  autoSwot: SwotData;
}

export interface SwotData {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export type DateFilterBasis = 'OPS' | 'PO' | 'ETD' | 'ETA' | 'DI' | 'DELIVERY';

export interface ComexFilters {
  search: string;
  pep: string;
  atoConcessorio: string;
  supplier: string;
  ncm: string;
  buyer: string;
  status: string;
  year: string;
  month: string;
  dateField: DateFilterBasis;
  hideDeleted: boolean;
}

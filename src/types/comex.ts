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
  DT_NF?: string;
  DATA_NF?: string;
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
  hasExplicitSapTaxes?: boolean;
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
  elementoPep: string;
  elementoPepCode: string;
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

export type PqrClass = 'P' | 'Q' | 'R';
export type AbcClass = 'A' | 'B' | 'C';
export type KraljicQuadrant = 'STRATEGIC' | 'LEVERAGE' | 'BOTTLENECK' | 'NON_CRITICAL';

export interface KraljicOverride {
  quadrant?: KraljicQuadrant;
  note?: string;
}

export interface MaterialProcurementItem {
  materialKey: string;
  materialCode: string;
  descPt: string;
  descEn: string;
  ncm: string;
  unit: string;
  poCount: number;
  lineCount: number;
  poNumbers: string[];
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
  avgUnitPriceBrl: number;
  maxUnitPriceBrl: number;
  totalSpendBrl: number;
  totalSpendOrig: number;
  currency: string;
  spendSharePct: number;
  cumulativeSpendPct: number;
  demandSharePct: number;
  cumulativeDemandPct: number;
  pqrClass: PqrClass;
  abcClass: AbcClass;
  profitImpactScore: number;
  supplyRiskScore: number;
  riskDrivers: string[];
  computedQuadrant: KraljicQuadrant;
  kraljicQuadrant: KraljicQuadrant;
  overrideNote: string;
  recommendedStrategy: string;
  avgDelayDays: number;
  delayedCount: number;
  hasMissingAc: boolean;
  items: FupItemRow[];
}

export interface MaterialAnalyticsResult {
  materials: MaterialProcurementItem[];
  totalSkus: number;
  totalSpendBrl: number;
  totalOrderedQty: number;
  totalReceivedQty: number;
  totalStockPlant0003: number;
  mostBought: MaterialProcurementItem | null;
  mostUsed: MaterialProcurementItem | null;
  mostExpensive: MaterialProcurementItem | null;
  highestUnitCost: MaterialProcurementItem | null;
  pqrCounts: Record<PqrClass, { count: number; spendBrl: number; qty: number }>;
  abcCounts: Record<AbcClass, { count: number; spendBrl: number }>;
  quadrantSummary: Record<
    KraljicQuadrant,
    { count: number; spendBrl: number; spendPct: number }
  >;
}

export type SimilarMatchTier = 'EXACT_DUPLICATE' | 'HIGH_SIMILARITY' | 'POSSIBLE_VARIANT';
export type SimilarAuditStatus =
  | 'PENDING'
  | 'CONFIRMED_DUPLICATE'
  | 'VALID_VARIANT'
  | 'DISMISSED';

export interface SimilarGroupDecision {
  status: SimilarAuditStatus;
  note?: string;
  primaryMaterialCode?: string;
  updatedAt?: string;
}

export interface SimilarPairEvidence {
  codeA: string;
  codeB: string;
  score: number;
  reasons: string[];
  specDifferences: string[];
}

export interface SimilarMaterialGroup {
  groupId: string;
  anchorTitle: string;
  tier: SimilarMatchTier;
  maxSimilarity: number;
  avgSimilarity: number;
  matchReasons: string[];
  specDifferences: string[];
  sharedTokens: string[];
  materials: MaterialProcurementItem[];
  pairEvidences: SimilarPairEvidence[];
  combinedSpendBrl: number;
  combinedOrderedQty: number;
  combinedStockPlant0003: number;
  minUnitPriceBrl: number;
  maxUnitPriceBrl: number;
  unitPriceSpreadPct: number;
  sameNcm: boolean;
  sameUnit: boolean;
  auditStatus: SimilarAuditStatus;
  auditNote: string;
  primaryMaterialCode: string;
}

export interface SimilarItemsAnalysisResult {
  groups: SimilarMaterialGroup[];
  totalGroups: number;
  totalMaterialsInvolved: number;
  exactDuplicateGroups: number;
  highSimilarityGroups: number;
  confirmedDuplicateGroups: number;
  pendingGroups: number;
  totalCombinedSpendBrl: number;
  maxPriceSpreadPct: number;
}

export type NumerarioSourceType =
  | 'SAP_DI'
  | 'DRAWBACK_SUSPENDED'
  | 'PRE_DI_SAP'
  | 'SIMULATED';
export type NumerarioTaxRegime = 'RECOLHIMENTO_INTEGRAL' | 'DRAWBACK_SUSP' | 'AGUARDANDO_AC';
export type NumerarioFinanceStatus = 'DRAFT' | 'REQUESTED' | 'APPROVED' | 'PAID';

export interface NumerarioOverride {
  regimeOverride?: 'AUTO' | 'RECOLHIMENTO_INTEGRAL' | 'DRAWBACK_SUSP';
  iiRatePct?: number;
  ipiRatePct?: number;
  pisRatePct?: number;
  cofinsRatePct?: number;
  icmsRatePct?: number;
  siscomexBrl?: number;
  valorAdtOverride?: number;
  numerarioDateOverride?: string;
  financeStatus?: NumerarioFinanceStatus;
  financeNote?: string;
}

export interface NumerarioCostLine {
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
  sourceType: NumerarioSourceType;
  taxRegime: NumerarioTaxRegime;
  // Customs taxes (BRL)
  iiBrl: number;
  ipiBrl: number;
  pisBrl: number;
  cofinsBrl: number;
  icmsBrl: number;
  siscomexBrl: number;
  afrmmBrl: number;
  totalTaxesBrl: number;
  // Effective rates (%)
  iiRatePct: number;
  ipiRatePct: number;
  pisRatePct: number;
  cofinsRatePct: number;
  icmsRatePct: number;
  // Port & clearance expenses (BRL)
  armazenagemBrl: number;
  capataziaBrl: number;
  brokerFeeBrl: number;
  liFeeBrl: number;
  ecotaxBrl: number;
  freteNacionalBrl: number;
  demurrageBrl: number;
  totalClearanceExpensesBrl: number;
  // Totals & Finance cash-call
  totalNumerarioBrl: number;
  potentialDrawbackSavingsBrl: number;
  valorAdiantadoBrl: number;
  saldoFinanceiroBrl: number;
  numerarioRequestDate: string;
  financeStatus: NumerarioFinanceStatus;
  financeNote: string;
  hasOverride: boolean;
  items: FupItemRow[];
}

export interface NumerarioAnalysisResult {
  rows: NumerarioCostLine[];
  totals: {
    valorAduaneiroBrl: number;
    iiBrl: number;
    ipiBrl: number;
    pisBrl: number;
    cofinsBrl: number;
    icmsBrl: number;
    siscomexBrl: number;
    afrmmBrl: number;
    totalTaxesBrl: number;
    totalClearanceExpensesBrl: number;
    totalNumerarioBrl: number;
    valorAdiantadoBrl: number;
    saldoFinanceiroBrl: number;
    drawbackSavedBrl: number;
    drawbackCoveredVaBrl: number;
    potentialSavingsIfAcLinkedBrl: number;
  };
  counts: {
    totalRows: number;
    shipmentRows: number;
    openPoRows: number;
    sapDiCount: number;
    preDiCount: number;
    simulatedCount: number;
    drawbackSuspCount: number;
    pendingCashCallCount: number;
  };
  taxBreakdownChart: Array<{
    name: string;
    key: string;
    valueBrl: number;
    color: string;
  }>;
}

export type ShipmentWorthinessVerdict = 'EFFICIENT' | 'REVIEW' | 'NOT_WORTH_IT';
export type AirEvaluationVerdict =
  | 'JUSTIFIED_AIR'
  | 'QUESTIONABLE_AIR'
  | 'AVOIDABLE_AIR'
  | 'NOT_APPLICABLE';

export type CostOptimizationCategory =
  | 'MODAL'
  | 'STORAGE_PORT'
  | 'INCOTERM'
  | 'DRAWBACK_AC'
  | 'SUPPLIER_SLA'
  | 'PURCHASING_BATCH';

export interface CostOptimizationAction {
  code: string;
  category: CostOptimizationCategory;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  detail: string;
  observedWasteBrl: number;
}

export interface ShipmentAirEvaluation {
  isAir: boolean;
  verdict: AirEvaluationVerdict;
  headline: string;
  rationale: string;
  freightPctOverFob: number;
  airportDwellDays: number;
  stockCoveragePct: number;
}

export interface ShipmentItemTroubleSummary {
  hasRecurringTrouble: boolean;
  lateOrderCount: number;
  totalHistoricalOrders: number;
  repeatAirCount: number;
  historicalDelayAvgDays: number;
  missingAcOrders: number;
  affectedMaterials: string[];
  troubleSignals: string[];
}

export interface ShipmentCostBenefitRow {
  ref: string;
  poList: string;
  exporter: string;
  pepProject: string;
  modal: string;
  incoterm: string;
  status: ShipmentOperationalStatus;
  canal: ShipmentProcessRow['canal'];
  etd: string;
  eta: string;
  fobBrl: number;
  cifBrl: number;
  intlFreightBrl: number;
  insuranceBrl: number;
  storageBrl: number;
  capataziaBrl: number;
  afrmmBrl: number;
  truckingBrl: number;
  brokerFeeBrl: number;
  liFeeBrl: number;
  ecotaxBrl: number;
  demurrageBrl: number;
  customsTaxesBrl: number;
  totalLogisticsCostBrl: number;
  totalExtraCostBrl: number;
  totalLandedBrl: number;
  landedMultiplier: number;
  freightPctOverFob: number;
  storagePctOverFob: number;
  logisticsPctOverFob: number;
  taxesPctOverFob: number;
  totalExtraPctOverFob: number;
  daysInPort: number;
  periodos: number;
  transitTime: number;
  leadTime: number;
  maxOrderDelayDays: number;
  stockPlant0003Total: number;
  observedAvoidableWasteBrl: number;
  worthinessVerdict: ShipmentWorthinessVerdict;
  worthinessReasons: string[];
  airEvaluation: ShipmentAirEvaluation;
  itemTroubleSummary: ShipmentItemTroubleSummary;
  recommendations: CostOptimizationAction[];
  process: ShipmentProcessRow;
}

export interface MaterialTroubleProfile {
  materialCode: string;
  descPt: string;
  descEn: string;
  ncm: string;
  primarySupplier: string;
  orderCount: number;
  lineCount: number;
  lateOrderCount: number;
  delayedRatePct: number;
  avgDelayDays: number;
  maxDelayDays: number;
  airShipmentCount: number;
  seaShipmentCount: number;
  exwOrderCount: number;
  missingAcCount: number;
  totalSpendBrl: number;
  totalFreightAndStorageBrl: number;
  totalStorageAndDemurrageBrl: number;
  avgCostOverFobPct: number;
  stockPlant0003: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  troubleSignals: string[];
  recommendedFutureFix: string;
  linkedProcesses: string[];
}

export interface ShipmentWorthinessAnalysisResult {
  rows: ShipmentCostBenefitRow[];
  materialTroubles: MaterialTroubleProfile[];
  summary: {
    totalShipments: number;
    totalFobBrl: number;
    totalLogisticsCostBrl: number;
    totalTaxesBrl: number;
    totalExtraCostBrl: number;
    totalLandedBrl: number;
    weightedExtraPctOverFob: number;
    weightedLogisticsPctOverFob: number;
    efficientCount: number;
    reviewCount: number;
    notWorthItCount: number;
    airShipmentCount: number;
    justifiedAirCount: number;
    questionableOrAvoidableAirCount: number;
    recurringTroubleSkuCount: number;
    highTroubleSkuCount: number;
    observedAvoidableWasteBrl: number;
  };
  chartCostRatioByProcess: Array<{
    name: string;
    processRef: string;
    fobBrl: number;
    logisticsBrl: number;
    taxesBrl: number;
    extraPctOverFob: number;
    verdict: ShipmentWorthinessVerdict;
  }>;
  chartWasteDrivers: Array<{
    name: string;
    key: string;
    valueBrl: number;
    color: string;
  }>;
}

export interface ComexChartsAnalyticsResult {
  totals: {
    totalShipments: number;
    totalPoCount: number;
    totalItemLines: number;
    registeredDiCount: number;
    total20Cntr: number;
    total40Cntr: number;
    totalContainers: number;
    totalTeus: number;
    seaShipments: number;
    airShipments: number;
    roadShipments: number;
    totalIntlFreightBrl: number;
    totalNationalFreightBrl: number;
    totalFreightBrl: number;
    freightPctOfFob: number;
    totalTaxesBrl: number;
    iiBrl: number;
    ipiBrl: number;
    pisBrl: number;
    cofinsBrl: number;
    icmsBrl: number;
    siscomexBrl: number;
    afrmmBrl: number;
    totalDelayDays: number;
    delayedPoCount: number;
    delayedLineCount: number;
    avgDelayDays: number;
    maxDelayDays: number;
    onTimeRatePct: number;
    avgClearanceDays: number;
    clearedProcessCount: number;
    avgNfTurnaroundDays: number;
    nfIssuedCount: number;
    nfPendingCount: number;
    avgTransitDays: number;
    avgLeadTimeDays: number;
    avgStorageDays: number;
    totalStoragePeriods: number;
    totalStorageCostBrl: number;
    totalInvoicesBrl: number;
    totalShippedFobBrl: number;
    totalOpenPoBrl: number;
    drawbackFobBrl: number;
    fullTaxFobBrl: number;
    drawbackCoveragePct: number;
  };
  // 1. Quantity of Shipments (by Stage)
  shipmentsByStage: Array<{
    stage: ShipmentOperationalStatus;
    count: number;
    pct: number;
    fobBrl: number;
    color: string;
  }>;
  // 2. Channels of Customs (DI Parametrization)
  customsChannels: Array<{
    key: 'VERDE' | 'AMARELO' | 'VERMELHO' | 'CINZA' | '-';
    count: number;
    pct: number;
    fobBrl: number;
    color: string;
  }>;
  // 3. Quantity of Containers & Modal Mix
  containerMix: Array<{
    key: 'CNTR_20' | 'CNTR_40' | 'TEUS' | 'AIR' | 'SEA' | 'ROAD';
    count: number;
    color: string;
  }>;
  containersByProcess: Array<{
    processRef: string;
    shortRef: string;
    c20: number;
    c40: number;
    teus: number;
    modal: string;
  }>;
  // 4. Costs of Freight (BRL)
  freightByProcess: Array<{
    processRef: string;
    shortRef: string;
    exporterShort: string;
    modal: string;
    intlFreightBrl: number;
    natFreightBrl: number;
    totalFreightBrl: number;
    freightPctFob: number;
  }>;
  // 5. Tax (Strict SAP Recorded Customs Taxes)
  taxByType: Array<{
    key: 'ICMS' | 'II' | 'COFINS' | 'IPI' | 'PIS' | 'SISCOMEX' | 'AFRMM';
    valueBrl: number;
    color: string;
  }>;
  taxByProcess: Array<{
    processRef: string;
    shortRef: string;
    regime: string;
    iiBrl: number;
    ipiBrl: number;
    pisCofinsBrl: number;
    icmsBrl: number;
    siscomexAfrmmBrl: number;
    totalTaxesBrl: number;
  }>;
  // 6. Delays Totalized
  delaysByStatus: Array<{
    statusKey: 'ON_TIME' | 'COMPLETED' | 'DELAYED';
    lineCount: number;
    totalDelayDays: number;
    color: string;
  }>;
  delaysByPo: Array<{
    poNumber: string;
    processRef: string;
    supplierShort: string;
    delayDays: number;
    pendingQty: number;
    valueBrl: number;
  }>;
  // 7. Time of Customs Clearance (Days)
  clearanceByProcess: Array<{
    processRef: string;
    shortRef: string;
    canal: string;
    presenceToDiDays: number;
    diToReleaseDays: number;
    totalClearanceDays: number;
    isCleared: boolean;
    color: string;
  }>;
  // 8. Time of NF Issue & Factory Turnaround (Days)
  nfByProcess: Array<{
    processRef: string;
    shortRef: string;
    nfNumber: string;
    nfStatusKey: 'ISSUED' | 'PENDING_NF' | 'AWAITING_CLEARANCE';
    turnaroundDays: number;
    color: string;
  }>;
  nfStatusSummary: Array<{
    statusKey: 'ISSUED' | 'PENDING_NF' | 'AWAITING_CLEARANCE';
    count: number;
    fobBrl: number;
    color: string;
  }>;
  // 9. Time of Delivery (Transit ETD->ETA vs Total Lead Time ETD->Delivery)
  deliveryByProcess: Array<{
    processRef: string;
    shortRef: string;
    modal: string;
    transitDays: number;
    portAndClearanceDays: number;
    totalLeadTimeDays: number;
  }>;
  // 10. Time of Storage (Terminal Dwell Days, 10d Periods & Cost BRL)
  storageByProcess: Array<{
    processRef: string;
    shortRef: string;
    terminal: string;
    storageDays: number;
    storagePeriods: number;
    storageCostBrl: number;
    color: string;
  }>;
  // 11. Invoices Values (BRL by Process & MIRO/FI Settlement Status)
  invoicesByProcess: Array<{
    processRef: string;
    shortRef: string;
    exporterShort: string;
    currency: string;
    invoiceOrig: number;
    invoiceBrl: number;
    cifBrl: number;
    miroStatusKey: 'PAID' | 'UPCOMING' | 'OVERDUE' | 'PROJECTED';
    color: string;
  }>;
  invoicesByFinancialStatus: Array<{
    statusKey: 'PAID' | 'UPCOMING' | 'OVERDUE' | 'PROJECTED';
    count: number;
    amountBrl: number;
    color: string;
  }>;
  // 12. Relevant Team & Department Results (PEP Projects, Drawback & Team Workload)
  pepProjectsChart: Array<{
    pepCode: string;
    pepLabel: string;
    drawbackBrl: number;
    fullTaxBrl: number;
    totalFobBrl: number;
    receivedPct: number;
  }>;
  teamResultsChart: Array<{
    memberName: string;
    roleKey: 'ANALYST' | 'BUYER';
    processOrPoCount: number;
    onTimeCount: number;
    delayedCount: number;
    fobBrl: number;
    onTimePct: number;
  }>;
}




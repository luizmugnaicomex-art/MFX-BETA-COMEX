import type {
  CostOptimizationAction,
  KraljicQuadrant,
  ShipmentAirEvaluation,
  ShipmentProcessRow,
} from '../types/comex';
import { AppLanguage, TRANSLATIONS, fmt } from './translations';

export function translateModal(modal: string, lang: AppLanguage): string {
  const tr = TRANSLATIONS[lang];
  const upper = (modal || '').toUpperCase();
  if (upper.includes('AÉR') || upper.includes('AER')) return tr.enums.modal.AEREO;
  if (upper.includes('MAR')) return tr.enums.modal.MARITIMO;
  if (upper.includes('ROD')) return tr.enums.modal.RODOVIARIO;
  return modal;
}

export function translateChannel(canal: string, lang: AppLanguage): string {
  const tr = TRANSLATIONS[lang];
  if (canal === 'VERDE' || canal === 'VD') return tr.enums.channel.VERDE;
  if (canal === 'AMARELO' || canal === 'AM') return tr.enums.channel.AMARELO;
  if (canal === 'VERMELHO' || canal === 'VM') return tr.enums.channel.VERMELHO;
  if (canal === 'CINZA' || canal === 'CZ') return tr.enums.channel.CINZA;
  return tr.enums.channel.NONE;
}

export function translateDeliveryStatus(sapStatus: string, lang: AppLanguage): string {
  const tr = TRANSLATIONS[lang];
  if (sapStatus === 'NO PRAZO') return tr.enums.deliveryStatus.ON_TIME;
  if (sapStatus === 'ATRASADO') return tr.enums.deliveryStatus.DELAYED;
  if (sapStatus === 'ENTREGA CONCLUIDA SAP') return tr.enums.deliveryStatus.COMPLETED;
  if (sapStatus === 'ITEM EXCLUIDO') return tr.enums.deliveryStatus.EXCLUDED;
  return sapStatus;
}

export function translateShipmentStatus(status: string, lang: AppLanguage): string {
  const tr = TRANSLATIONS[lang];
  if (status === 'AG. PRONTIDAO DA CARGA') return tr.enums.shipmentStatus.AG_PRONTIDAO;
  if (status === 'EM TRÂNSITO') return tr.enums.shipmentStatus.EM_TRANSITO;
  if (status === 'AG. DESEMBARAÇO') return tr.enums.shipmentStatus.AG_DESEMBARACO;
  if (status === 'PARADO AG. DRAWBACK') return tr.enums.shipmentStatus.PARADO_DRAWBACK;
  if (status === 'ENTREGUE') return tr.enums.shipmentStatus.ENTREGUE;
  return status;
}

export function translatePipelineStage(stage: string, lang: AppLanguage): string {
  const tr = TRANSLATIONS[lang];
  if (stage === 'AG. PRONTIDAO DA CARGA') return tr.enums.pipelineStage.AG_PRONTIDAO;
  if (stage === 'EM TRÂNSITO') return tr.enums.pipelineStage.EM_TRANSITO;
  if (stage === 'AG. DESEMBARAÇO') return tr.enums.pipelineStage.AG_DESEMBARACO;
  if (stage === 'PARADO AG. DRAWBACK') return tr.enums.pipelineStage.PARADO_DRAWBACK;
  if (stage === 'ENTREGUE') return tr.enums.pipelineStage.ENTREGUE;
  return stage;
}

export function translateFinancialStatus(status: string, lang: AppLanguage): string {
  const tr = TRANSLATIONS[lang];
  if (status === 'PAGO') return tr.enums.financialStatus.PAGO;
  if (status === 'A VENCER') return tr.enums.financialStatus.A_VENCER;
  if (status === 'VENCIDA') return tr.enums.financialStatus.VENCIDA;
  if (status === 'PROJETADO') return tr.enums.financialStatus.PROJETADO;
  return status;
}

export function translateFinancialSource(source: string, lang: AppLanguage): string {
  const tr = TRANSLATIONS[lang];
  if (source === 'MIRO/FI') return tr.enums.financialSource.MIRO_FI;
  if (source === 'LOGISTICS') return tr.enums.financialSource.LOGISTICS;
  if (source === 'CUSTOMS/TAXES') return tr.enums.financialSource.CUSTOMS_TAXES;
  return source;
}

export function translateFinancialCategory(category: string, lang: AppLanguage): string {
  if (lang === 'pt') return category;
  if (category === 'Fatura Fornecedor (Material)') {
    return lang === 'it' ? 'Fattura Fornitore (Materiale)' : 'Supplier Invoice (Material)';
  }
  if (category === 'Previsão Fornecedor (Open PO)') {
    return lang === 'it' ? 'Previsione Fornitore (PO Aperto)' : 'Supplier Forecast (Open PO)';
  }
  if (category === 'Frete Internacional') {
    return lang === 'it' ? 'Nolo Internazionale' : 'International Freight';
  }
  if (category === 'Armazenagem, AFRMM & Desembaraço') {
    return lang === 'it'
      ? 'Magazzino, AFRMM & Sdoganamento'
      : 'Port Storage, AFRMM & Clearance';
  }
  if (category === 'Impostos Aduaneiros (II/IPI/PIS/COFINS/ICMS)') {
    return lang === 'it'
      ? 'Tributi Doganali (II/IPI/PIS/COFINS/ICMS)'
      : 'Customs Taxes (II/IPI/PIS/COFINS/ICMS)';
  }
  return category;
}

export function translateKraljicStrategy(quadrant: KraljicQuadrant, lang: AppLanguage): string {
  return TRANSLATIONS[lang].kraljic.strategies[quadrant];
}

export function translateRiskDriver(driver: string, lang: AppLanguage): string {
  if (lang === 'en') return driver;
  if (driver === 'Single supplier') {
    return lang === 'pt' ? 'Fornecedor único' : 'Fornitore unico';
  }
  if (driver === '2 suppliers') {
    return lang === 'pt' ? '2 fornecedores' : '2 fornitori';
  }
  const delayMatch = driver.match(/^Avg delay \+(\d+)d$/);
  if (delayMatch) {
    return lang === 'pt'
      ? `Atraso méd. +${delayMatch[1]}d`
      : `Ritardo med. +${delayMatch[1]}g`;
  }
  const pendDelMatch = driver.match(/^(\d+)% pending delivery$/);
  if (pendDelMatch) {
    return lang === 'pt'
      ? `${pendDelMatch[1]}% entrega pend.`
      : `${pendDelMatch[1]}% consegna pend.`;
  }
  const pendMatch = driver.match(/^(\d+)% pending$/);
  if (pendMatch) {
    return lang === 'pt' ? `${pendMatch[1]}% pendente` : `${pendMatch[1]}% pendente`;
  }
  if (driver === 'Missing Drawback AC') {
    return lang === 'pt' ? 'Sem AC Drawback' : 'Senza AC Drawback';
  }
  if (driver === 'Canal Vermelho') {
    return lang === 'pt' ? 'Canal Vermelho' : 'Canale Rosso';
  }
  if (driver === 'Canal Amarelo/Cinza') {
    return lang === 'pt' ? 'Canal Amarelo/Cinza' : 'Canale Giallo/Grigio';
  }
  if (driver === 'Air freight modal') {
    return lang === 'pt' ? 'Modal aéreo' : 'Trasporto aereo';
  }
  if (driver === 'Unshipped open PO') {
    return lang === 'pt' ? 'PO aberto s/ embarque' : 'PO aperto non spedito';
  }
  return driver;
}

export function translateMatchReason(reason: string, lang: AppLanguage): string {
  if (lang === 'en') return reason;
  if (reason === 'Exact PT description match') {
    return lang === 'pt' ? 'Descrição PT idêntica' : 'Descrizione PT identica';
  }
  if (reason === 'Exact EN description match') {
    return lang === 'pt' ? 'Descrição EN idêntica' : 'Descrizione EN identica';
  }
  if (reason === 'Shared supplier') {
    return lang === 'pt' ? 'Fornecedor em comum' : 'Fornitore in comune';
  }
  if (reason.startsWith('Same NCM chapter ')) {
    const ch = reason.replace('Same NCM chapter ', '');
    return lang === 'pt' ? `Mesmo capítulo NCM ${ch}` : `Stesso capitolo NCM ${ch}`;
  }
  if (reason.startsWith('Same NCM ')) {
    const ncm = reason.replace('Same NCM ', '');
    return lang === 'pt' ? `Mesma NCM ${ncm}` : `Stesso NCM ${ncm}`;
  }
  const sameUnitMatch = reason.match(/^Same unit \((.+)\)$/);
  if (sameUnitMatch) {
    return lang === 'pt'
      ? `Mesma unidade (${sameUnitMatch[1]})`
      : `Stessa unità (${sameUnitMatch[1]})`;
  }
  const diffUnitMatch = reason.match(/^Different units \((.+) vs (.+)\)$/);
  if (diffUnitMatch) {
    return lang === 'pt'
      ? `Unidades distintas (${diffUnitMatch[1]} vs ${diffUnitMatch[2]})`
      : `Unità diverse (${diffUnitMatch[1]} vs ${diffUnitMatch[2]})`;
  }
  if (reason.startsWith('Shared: ')) {
    const rest = reason.slice('Shared: '.length);
    return lang === 'pt' ? `Em comum: ${rest}` : `In comune: ${rest}`;
  }
  const strMatch = reason.match(/^(\d+)% string match$/);
  if (strMatch) {
    return lang === 'pt'
      ? `${strMatch[1]}% similaridade textual`
      : `${strMatch[1]}% affinità testo`;
  }
  return reason;
}

export function translateAirHeadline(
  airEval: ShipmentAirEvaluation,
  modal: string,
  lang: AppLanguage
): string {
  if (lang === 'en') return airEval.headline;
  if (airEval.verdict === 'AVOIDABLE_AIR') {
    return lang === 'pt'
      ? 'Velocidade Aérea Desperdiçada — ROI Negativo do Modal'
      : 'Velocità Aerea Sprecata — ROI Negativo della Modalità';
  }
  if (airEval.verdict === 'QUESTIONABLE_AIR') {
    return lang === 'pt'
      ? 'Escolha Aérea no Limite — Validar Urgência'
      : 'Scelta Aerea al Limite — Verificare Urgenza';
  }
  if (airEval.verdict === 'JUSTIFIED_AIR') {
    return lang === 'pt'
      ? 'Aéreo Justificado — Desembaraço Ágil e SLA Cumprido'
      : 'Aereo Giustificato — Sdoganamento Rapido & SLA Rispettato';
  }
  return lang === 'pt'
    ? `Modal ${translateModal(modal, 'pt')}`
    : `Modalità ${translateModal(modal, 'it')}`;
}

export function translateAirRationale(
  airEval: ShipmentAirEvaluation,
  modal: string,
  lang: AppLanguage,
  periods: number,
  status: string,
  maxDelayDays: number,
  transitTime: number
): string {
  if (lang === 'en') return airEval.rationale;
  const f = airEval.freightPctOverFob;
  const d = airEval.airportDwellDays;
  const s = airEval.stockCoveragePct;
  const modName = translateModal(modal, lang).toLowerCase();

  if (airEval.verdict === 'NOT_APPLICABLE') {
    if (periods >= 2 || airEval.rationale.includes('port dwell')) {
      return lang === 'pt'
        ? `Frete ${modName} consolidado (${f}% do FOB), mas estadia portuária (${d}d / ${periods} períodos) consumiu parte da economia.`
        : `Nolo ${modName} consolidato (${f}% del FOB), ma la sosta portuale (${d}g / ${periods} periodi) ha eroso il risparmio.`;
    }
    return lang === 'pt'
      ? `Frete em ${f}% do FOB com execução ${modName} controlada.`
      : `Nolo al ${f}% del FOB con esecuzione ${modName} sotto controllo.`;
  }
  if (airEval.verdict === 'AVOIDABLE_AIR') {
    const statusText = translatePipelineStage(status, lang);
    return lang === 'pt'
      ? `Pagou ${f}% de frete aéreo sobre o FOB, mas permaneceu ${d}d em terminal (${statusText}), estoque na Planta 0003 em ${s}% e atraso máx. +${maxDelayDays}d. Consolidação marítima ou AC prévio teria evitado custo extra.`
      : `Pagato ${f}% di nolo aereo sul FOB con ${d}g di sosta in terminal (${statusText}), copertura stock in Stab. 0003 al ${s}% e ritardo max +${maxDelayDays}g. Consolidamento via mare o AC anticipato avrebbe risparmiato costi.`;
  }
  if (airEval.verdict === 'QUESTIONABLE_AIR') {
    return lang === 'pt'
      ? `Frete aéreo consumiu ${f}% do FOB com ${d}d em aeroporto e ${s}% de cobertura na Planta 0003. Confirmar risco real de parada antes de repetir modal aéreo.`
      : `Il nolo aereo ha assorbito ${f}% del FOB con ${d}g in aeroporto e ${s}% di copertura in Stab. 0003. Confermare urgenza critica prima di ripetere la modalità aerea.`;
  }
  return lang === 'pt'
    ? `Frete aéreo controlado (${f}% do FOB), trânsito rápido de ${transitTime || 3}d e desembaraço em ${d}d sem atraso na entrega.`
    : `Nolo aereo controllato (${f}% del FOB), transito rapido di ${transitTime || 3}g e sdoganamento in ${d}g senza ritardi.`;
}

export function translateTroubleSignal(signal: string, lang: AppLanguage): string {
  if (lang === 'en') return signal;

  const repDelay = signal.match(/^Repeat delays \((\d+)\/(\d+) POs\)$/);
  if (repDelay) {
    return lang === 'pt'
      ? `Atrasos recorrentes (${repDelay[1]}/${repDelay[2]} POs)`
      : `Ritardi ricorrenti (${repDelay[1]}/${repDelay[2]} PO)`;
  }
  const delaySla = signal.match(/^Delayed \+(\d+)d vs SLA$/);
  if (delaySla) {
    return lang === 'pt'
      ? `Atraso +${delaySla[1]}d vs SLA`
      : `Ritardo +${delaySla[1]}g vs SLA`;
  }
  const delayPlain = signal.match(/^Delayed \+(\d+)d$/);
  if (delayPlain) {
    return lang === 'pt' ? `Atraso +${delayPlain[1]}d` : `Ritardo +${delayPlain[1]}g`;
  }
  const repAir = signal.match(/^Repeat Air freight \((\d+)x\)$/);
  if (repAir) {
    return lang === 'pt'
      ? `Aéreo repetido (${repAir[1]}x)`
      : `Aereo ripetuto (${repAir[1]}x)`;
  }
  if (signal === 'Emergency Air + Late delivery') {
    return lang === 'pt' ? 'Aéreo emergencial + Atraso' : 'Aereo emergenza + Ritardo';
  }
  if (signal === 'Missing Drawback AC') {
    return lang === 'pt' ? 'Sem AC Drawback' : 'Senza AC Drawback';
  }
  if (signal === 'EXW origin cost exposure') {
    return lang === 'pt' ? 'Exposição de origem EXW' : 'Esposizione costi origine EXW';
  }
  if (signal === 'High port storage / demurrage') {
    return lang === 'pt' ? 'Alta armazenagem / demurrage' : 'Sosta portuale / demurrage elevati';
  }
  if (signal === 'Customs Yellow/Red channel') {
    return lang === 'pt' ? 'Canal Amarelo/Vermelho' : 'Canale Giallo/Rosso';
  }
  return signal;
}

export function translateFutureFix(fixText: string, lang: AppLanguage): string {
  if (lang === 'en') return fixText;
  const clean = fixText.replace(/\.$/, '');
  const parts = clean.split('; ').map((part) => {
    if (part === 'Link Drawback AC at PO creation to avoid customs holds') {
      return lang === 'pt'
        ? 'Vincular AC Drawback na criação do PO para evitar retenção aduaneira'
        : 'Collegare AC Drawback alla creazione del PO per evitare blocchi doganali';
    }
    if (part === 'Enforce Supplier SLA + extend MRP buffer lead time') {
      return lang === 'pt'
        ? 'Cobrar SLA do fornecedor e ampliar buffer de lead time no MRP'
        : 'Applicare SLA fornitore ed estendere il buffer lead time in MRP';
    }
    if (part === 'Consolidate into scheduled Sea PO / Blanket agreement') {
      return lang === 'pt'
        ? 'Consolidar em PO marítimo programado ou contrato guarda-chuva'
        : 'Consolidare in ordini marittimi programmati / contratto quadro';
    }
    if (part === 'Renegotiate Incoterm EXW → FCA/FOB') {
      return lang === 'pt'
        ? 'Renegociar Incoterm de EXW → FCA/FOB'
        : 'Rinegoziare Incoterm EXW → FCA/FOB';
    }
    if (part === 'Pre-file DI & advance Numerário at ETA -5d to clear in Period 1') {
      return lang === 'pt'
        ? 'Pré-registrar DI e antecipar Numerário em ETA -5d p/ liberar no 1º Período'
        : 'Pre-registrare DI e anticipare Numerário a ETA -5g per svincolo nel Periodo 1';
    }
    if (part === 'Maintain current sourcing cadence and customs pre-alert check') {
      return lang === 'pt'
        ? 'Manter cadência atual de compras e conferência de Pre-Alert aduaneiro'
        : 'Mantenere l’attuale cadenza di acquisto e verifica Pre-Alert doganale';
    }
    return part;
  });
  return parts.join('; ') + '.';
}

export function translateRecommendation(
  rec: CostOptimizationAction,
  row: {
    process: ShipmentProcessRow;
    stockPlant0003Total: number;
    airEvaluation: ShipmentAirEvaluation;
    freightPctOverFob: number;
    demurrageBrl: number;
    storageBrl: number;
    periodos: number;
    daysInPort: number;
    maxOrderDelayDays: number;
    itemTroubleSummary: { lateOrderCount: number; historicalDelayAvgDays: number };
  },
  lang: AppLanguage
): { title: string; detail: string } {
  if (lang === 'en') return { title: rec.title, detail: rec.detail };

  switch (rec.code) {
    case 'LINK_DRAWBACK_AC':
      return lang === 'pt'
        ? {
            title: 'Pré-vincular Ato Concessório Drawback antes do ETD',
            detail: fmt(
              'Processo com NCM elegível sem AC vinculado ({status}). Anexar o AC antes da chegada evita parada aduaneira e armazenagem extra ({storage}).',
              {
                status: translatePipelineStage(row.process.status, 'pt'),
                storage:
                  row.storageBrl > 0
                    ? `R$ ${row.storageBrl.toLocaleString('pt-BR')}`
                    : 'taxas de terminal pendentes',
              }
            ),
          }
        : {
            title: 'Pre-collegare Ato Concessório Drawback prima dell’ETD',
            detail: fmt(
              'Pratica con NCM idoneo privo di AC collegato ({status}). Associare l’AC prima dell’arrivo evita blocchi doganali e sosta extra ({storage}).',
              {
                status: translatePipelineStage(row.process.status, 'it'),
                storage:
                  row.storageBrl > 0
                    ? `R$ ${row.storageBrl.toLocaleString('pt-BR')}`
                    : 'diritti terminal in sospeso',
              }
            ),
          };
    case 'SHIFT_AIR_TO_SEA':
      return lang === 'pt'
        ? {
            title: 'Evitar Aéreo reativo — migrar SKU recorrente para Marítimo LCL/FCL',
            detail:
              translateAirRationale(
                row.airEvaluation,
                row.process.modal,
                'pt',
                row.periodos,
                row.process.status,
                row.maxOrderDelayDays,
                row.process.transitTime
              ) + ' Antecipar emissão do PO em 45 dias no MRP para atender via marítimo.',
          }
        : {
            title: 'Evitare Aereo reattivo — spostare SKU ricorrenti su Mare LCL/FCL',
            detail:
              translateAirRationale(
                row.airEvaluation,
                row.process.modal,
                'it',
                row.periodos,
                row.process.status,
                row.maxOrderDelayDays,
                row.process.transitTime
              ) + ' Anticipare l’emissione del PO di 45 giorni in MRP per spedire via mare.',
          };
    case 'AUDIT_AIR_TRIGGER':
      return lang === 'pt'
        ? {
            title: 'Exigir validação de falta na Planta 0003 antes de aprovar Aéreo',
            detail: fmt(
              'Planta 0003 possui {stock} unid. ({cov}% do PO). Confirmar risco real de parada de linha antes de pagar prêmio aéreo ({frt}% do FOB).',
              {
                stock: row.stockPlant0003Total,
                cov: row.airEvaluation.stockCoveragePct,
                frt: row.freightPctOverFob,
              }
            ),
          }
        : {
            title: 'Richiedere verifica rottura stock Stab. 0003 prima di autorizzare Aereo',
            detail: fmt(
              'Lo Stabilimento 0003 dispone di {stock} unità ({cov}% del PO). Verificare il rischio fermo linea prima di pagare il sovrapprezzo aereo ({frt}% FOB).',
              {
                stock: row.stockPlant0003Total,
                cov: row.airEvaluation.stockCoveragePct,
                frt: row.freightPctOverFob,
              }
            ),
          };
    case 'NEGOTIATE_DEMURRAGE_FT':
      return lang === 'pt'
        ? {
            title: 'Eliminar Demurrage com Free Time ≥21d e devolução ágil do contêiner',
            detail: fmt(
              'Processo registrou R$ {dem} em demurrage. Negociar >=21d de free time combinado com o armador e priorizar devolução do vazio pós-MIGO.',
              { dem: row.demurrageBrl.toLocaleString('pt-BR') }
            ),
          }
        : {
            title: 'Eliminare Demurrage con Free Time ≥21g e rientro rapido container',
            detail: fmt(
              'La pratica ha registrato R$ {dem} di demurrage. Negoziare >=21g di free time con la compagnia e accelerare la restituzione del vuoto post-MIGO.',
              { dem: row.demurrageBrl.toLocaleString('pt-BR') }
            ),
          };
    case 'PRE_CLEAR_PERIOD_1':
      return lang === 'pt'
        ? {
            title: `Reduzir armazenagem (${row.periodos} períodos / ${row.daysInPort}d) para o 1º Período`,
            detail: `Carga avançou para o ${row.periodos}º Período de armazenagem. Pré-registrar minuta da DI, validar NCM e antecipar Numerário 5 dias antes do ETA.`,
          }
        : {
            title: `Ridurre sosta (${row.periodos} periodi / ${row.daysInPort}g) al Periodo 1`,
            detail: `La merce è entrata nel Periodo di sosta ${row.periodos}. Pre-registrare bozza DI, validare NCM e anticipare Numerário 5 giorni prima dell’ETA.`,
          };
    case 'INCOTERM_EXW_TO_FCA':
      return lang === 'pt'
        ? {
            title: 'Renegociar Incoterm de EXW para FCA/FOB',
            detail:
              'EXW obriga a MFX a pagar coleta na origem, despacho de exportação e taxas extras no destino. Migrar para FCA na próxima cotação elimina custos locais.',
          }
        : {
            title: 'Rinegoziare Incoterm da EXW a FCA/FOB',
            detail:
              'La resa EXW addebita a MFX ritiro in origine, sdoganamento export ed extra a destino. Passare a FCA nella prossima RFQ abbatte i costi all’origine.',
          };
    case 'SUPPLIER_SLA_REVIEW':
      return lang === 'pt'
        ? {
            title: 'Tratar atraso recorrente de fornecedor/SKU nos próximos POs',
            detail: `${row.process.exporter} / SKU acumula ${row.itemTroubleSummary.lateOrderCount} pedido(s) atrasado(s) (média ${row.itemTroubleSummary.historicalDelayAvgDays || row.maxOrderDelayDays}d). Aplicar SLA contratual, buffer no MRP ou segunda fonte.`,
          }
        : {
            title: 'Risolvere ritardi ricorrenti fornitore/SKU sui futuri PO',
            detail: `${row.process.exporter} / SKU ha registrato ${row.itemTroubleSummary.lateOrderCount} ordini in ritardo (media ${row.itemTroubleSummary.historicalDelayAvgDays || row.maxOrderDelayDays}g). Applicare SLA contrattuale, buffer o secondo fornitore.`,
          };
    case 'CHANNEL_DOC_COMPLIANCE':
      return lang === 'pt'
        ? {
            title: `Pré-auditar NCM & especificações da Invoice (${translateChannel(row.process.canal, 'pt')})`,
            detail: `Parametrizado em ${translateChannel(row.process.canal, 'pt')}, elevando estadia para ${row.daysInPort}d. Padronizar catálogo técnico bilíngue e dossiê antes do ETD.`,
          }
        : {
            title: `Pre-verificare NCM & specifiche Fattura (${translateChannel(row.process.canal, 'it')})`,
            detail: `Parametrizzato in ${translateChannel(row.process.canal, 'it')}, estendendo la sosta a ${row.daysInPort}g. Standardizzare catalogo tecnico bilingue e certificati prima dell’ETD.`,
          };
    default:
      return { title: rec.title, detail: rec.detail };
  }
}

export function translateWorthinessReason(reason: string, lang: AppLanguage): string {
  if (lang === 'en') return reason;
  const logConsumed = reason.match(/^Logistics & port fees consumed (.+)% of Order FOB$/);
  if (logConsumed) {
    return lang === 'pt'
      ? `Logística e taxas consumiram ${logConsumed[1]}% do FOB`
      : `Logistica e porto hanno assorbito il ${logConsumed[1]}% del FOB`;
  }
  const elevLog = reason.match(/^Elevated logistics cost ratio \((.+)% of FOB\)$/);
  if (elevLog) {
    return lang === 'pt'
      ? `Custo logístico elevado (${elevLog[1]}% do FOB)`
      : `Incidenza logistica elevata (${elevLog[1]}% del FOB)`;
  }
  const highLanded = reason.match(
    /^High total landed burden \(\+(.+)% w\/ SAP taxes — review Drawback\/sourcing\)$/
  );
  if (highLanded) {
    return lang === 'pt'
      ? `Carga total alta (+${highLanded[1]}% c/ impostos SAP — revisar Drawback/compra)`
      : `Carico totale elevato (+${highLanded[1]}% con imposte SAP — rivedere Drawback/sourcing)`;
  }
  const elevExtra = reason.match(/^Elevated total extra burden \((.+)% over FOB\)$/);
  if (elevExtra) {
    return lang === 'pt'
      ? `Custo extra elevado (${elevExtra[1]}% sobre FOB)`
      : `Extracosto elevato (${elevExtra[1]}% su FOB)`;
  }
  const dem = reason.match(/^Container demurrage incurred \(R\$ (.+)\)$/);
  if (dem) {
    return lang === 'pt'
      ? `Incidência de demurrage (R$ ${dem[1]})`
      : `Addebito demurrage container (R$ ${dem[1]})`;
  }
  if (reason === 'Air freight premium wasted (blocked/unnecessary urgency)') {
    return lang === 'pt'
      ? 'Frete aéreo desperdiçado (carga retida/urgência evitável)'
      : 'Premio aereo sprecato (fermo doganale / urgenza evitabile)';
  }
  if (reason === 'Air freight urgency needs confirmation') {
    return lang === 'pt'
      ? 'Urgência do frete aéreo requer confirmação'
      : 'Urgenza trasporto aereo da confermare';
  }
  const extStor = reason.match(/^Extended terminal storage \((\d+) periods · (\d+)d\)$/);
  if (extStor) {
    return lang === 'pt'
      ? `Armazenagem prolongada (${extStor[1]} períodos · ${extStor[2]}d)`
      : `Sosta terminal prolungata (${extStor[1]} periodi · ${extStor[2]}g)`;
  }
  if (reason === 'Eligible NCM shipped without Drawback AC') {
    return lang === 'pt'
      ? 'NCM elegível embarcada sem AC Drawback'
      : 'NCM idoneo spedito senza AC Drawback';
  }
  const ctrl = reason.match(/^Controlled extra cost \((.+)% over FOB\) with clean clearance$/);
  if (ctrl) {
    return lang === 'pt'
      ? `Custo extra controlado (${ctrl[1]}% sobre FOB) e desembaraço ágil`
      : `Costo extra controllato (${ctrl[1]}% su FOB) e sdoganamento lineare`;
  }
  return reason;
}

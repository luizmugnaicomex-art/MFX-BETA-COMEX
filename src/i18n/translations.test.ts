import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANSLATIONS, fmt, type AppLanguage } from './translations';
import {
  translateAirHeadline,
  translateAirRationale,
  translateChannel,
  translateDeliveryStatus,
  translateFinancialCategory,
  translateFinancialSource,
  translateFinancialStatus,
  translateFutureFix,
  translateKraljicStrategy,
  translateMatchReason,
  translateModal,
  translatePipelineStage,
  translateRecommendation,
  translateRiskDriver,
  translateShipmentStatus,
  translateTroubleSignal,
  translateWorthinessReason,
} from './helpers';
import type { ShipmentProcessRow } from '../types/comex';

function collectLeafEntries(
  obj: Record<string, unknown>,
  prefix = ''
): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'string') {
      out.push([path, val]);
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      out.push(...collectLeafEntries(val as Record<string, unknown>, path));
    }
  }
  return out;
}

function extractPlaceholders(str: string): string[] {
  const matches = str.match(/\{([a-zA-Z0-9_]+)\}/g) || [];
  return [...new Set(matches)].sort();
}

test('all three languages (en, pt, it) have identical translation keys, non-empty strings, and matching placeholders', () => {
  const enMap = new Map(collectLeafEntries(TRANSLATIONS.en as unknown as Record<string, unknown>));
  const ptMap = new Map(collectLeafEntries(TRANSLATIONS.pt as unknown as Record<string, unknown>));
  const itMap = new Map(collectLeafEntries(TRANSLATIONS.it as unknown as Record<string, unknown>));

  assert.ok(enMap.size > 200, `Expected >200 translation leaves, got ${enMap.size}`);

  for (const [path, enVal] of enMap) {
    assert.ok(enVal.trim().length > 0, `Empty EN value at ${path}`);
    assert.ok(ptMap.has(path), `Missing PT key: ${path}`);
    assert.ok(itMap.has(path), `Missing IT key: ${path}`);

    const ptVal = ptMap.get(path)!;
    const itVal = itMap.get(path)!;
    assert.ok(ptVal.trim().length > 0, `Empty PT value at ${path}`);
    assert.ok(itVal.trim().length > 0, `Empty IT value at ${path}`);

    const enPh = extractPlaceholders(enVal);
    const ptPh = extractPlaceholders(ptVal);
    const itPh = extractPlaceholders(itVal);
    assert.deepEqual(ptPh, enPh, `Placeholder mismatch in PT at ${path}: ${ptPh} vs ${enPh}`);
    assert.deepEqual(itPh, enPh, `Placeholder mismatch in IT at ${path}: ${itPh} vs ${enPh}`);
  }

  for (const path of ptMap.keys()) {
    assert.ok(enMap.has(path), `Extra PT key not in EN: ${path}`);
  }
  for (const path of itMap.keys()) {
    assert.ok(enMap.has(path), `Extra IT key not in EN: ${path}`);
  }
});

test('fmt() interpolates placeholders cleanly and preserves unknown tokens', () => {
  assert.equal(fmt('PO {po} · {count} items', { po: '68001', count: 4 }), 'PO 68001 · 4 items');
  assert.equal(fmt('Hello {name}, {missing}', { name: 'Comex' }), 'Hello Comex, {missing}');
});

test('enum translators map raw SAP values accurately across en, pt, and it', () => {
  const langs: AppLanguage[] = ['en', 'pt', 'it'];
  for (const lang of langs) {
    assert.notEqual(translateModal('AÉREO', lang), '');
    assert.notEqual(translateModal('MARÍTIMO', lang), '');
    assert.notEqual(translateChannel('VERDE', lang), '');
    assert.notEqual(translateChannel('CZ', lang), '');
    assert.notEqual(translateDeliveryStatus('ATRASADO', lang), '');
    assert.notEqual(translateShipmentStatus('AG. DESEMBARAÇO', lang), '');
    assert.notEqual(translatePipelineStage('PARADO AG. DRAWBACK', lang), '');
    assert.notEqual(translateFinancialStatus('VENCIDA', lang), '');
    assert.notEqual(translateFinancialSource('CUSTOMS/TAXES', lang), '');
    assert.notEqual(translateKraljicStrategy('STRATEGIC', lang), '');
  }

  assert.equal(translateChannel('VERDE', 'pt'), 'Canal Verde');
  assert.equal(translateChannel('VERDE', 'en'), 'Green Channel');
  assert.equal(translateChannel('VERDE', 'it'), 'Canale Verde');

  assert.equal(translateModal('AÉREO', 'en'), 'Air');
  assert.equal(translateModal('AÉREO', 'pt'), 'Aéreo');
  assert.equal(translateModal('AÉREO', 'it'), 'Aereo');

  assert.equal(
    translateFinancialCategory('Frete Internacional', 'it'),
    'Nolo Internazionale'
  );
  assert.equal(
    translateFinancialCategory('Frete Internacional', 'en'),
    'International Freight'
  );
});

test('engine signal, match reason, and Kraljic risk driver translators handle regex & exact strings', () => {
  assert.equal(translateRiskDriver('Avg delay +14d', 'pt'), 'Atraso méd. +14d');
  assert.equal(translateRiskDriver('Avg delay +14d', 'it'), 'Ritardo med. +14g');
  assert.equal(translateRiskDriver('Single supplier', 'it'), 'Fornitore unico');

  assert.equal(translateMatchReason('87% string match', 'pt'), '87% similaridade textual');
  assert.equal(translateMatchReason('Same NCM chapter 85', 'it'), 'Stesso capitolo NCM 85');

  assert.equal(translateTroubleSignal('Repeat delays (3/5 POs)', 'pt'), 'Atrasos recorrentes (3/5 POs)');
  assert.equal(translateTroubleSignal('Emergency Air + Late delivery', 'it'), 'Aereo emergenza + Ritardo');

  assert.equal(
    translateFutureFix(
      'Renegotiate Incoterm EXW → FCA/FOB; Pre-file DI & advance Numerário at ETA -5d to clear in Period 1.',
      'pt'
    ),
    'Renegociar Incoterm de EXW → FCA/FOB; Pré-registrar DI e antecipar Numerário em ETA -5d p/ liberar no 1º Período.'
  );

  assert.equal(
    translateWorthinessReason('Extended terminal storage (3 periods · 24d)', 'it'),
    'Sosta terminal prolungata (3 periodi · 24g)'
  );
});

test('air evaluation and recommendation translators work across all 3 languages', () => {
  const dummyProcess = {
    modal: 'AÉREO',
    canal: 'AMARELO',
    exporter: 'TEST SUPPLIER',
    status: 'AG. DESEMBARAÇO',
    transitTime: 5,
  } as ShipmentProcessRow;

  const airEval = {
    isAir: true,
    verdict: 'AVOIDABLE_AIR' as const,
    headline: 'Air Speed Wasted — Negative Modal ROI',
    rationale: 'Fallback EN rationale',
    freightPctOverFob: 38,
    airportDwellDays: 19,
    stockCoveragePct: 120,
  };

  assert.ok(translateAirHeadline(airEval, 'AÉREO', 'pt').includes('Velocidade Aérea Desperdiçada'));
  assert.ok(translateAirHeadline(airEval, 'AÉREO', 'it').includes('Velocità Aerea Sprecata'));

  const itRationale = translateAirRationale(
    airEval,
    'AÉREO',
    'it',
    2,
    'AG. DESEMBARAÇO',
    10,
    5
  );
  assert.ok(itRationale.includes('38%'));
  assert.ok(itRationale.includes('19g'));

  const ptRec = translateRecommendation(
    {
      code: 'AUDIT_AIR_TRIGGER',
      category: 'MODAL',
      priority: 'HIGH',
      title: 'Require Plant 0003 outage check',
      detail: 'Raw detail',
      observedWasteBrl: 5000,
    },
    {
      process: dummyProcess,
      stockPlant0003Total: 40,
      airEvaluation: airEval,
      freightPctOverFob: 38,
      demurrageBrl: 0,
      storageBrl: 12000,
      periodos: 2,
      daysInPort: 19,
      maxOrderDelayDays: 10,
      itemTroubleSummary: { lateOrderCount: 2, historicalDelayAvgDays: 8 },
    },
    'pt'
  );
  assert.ok(ptRec.title.includes('Planta 0003'));
  assert.ok(ptRec.detail.includes('120%'));
});

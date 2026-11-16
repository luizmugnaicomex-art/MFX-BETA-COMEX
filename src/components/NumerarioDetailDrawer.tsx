import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  ExternalLink,
  RotateCcw,
  Save,
  ShieldCheck,
  X,
} from 'lucide-react';
import type {
  NumerarioCostLine,
  NumerarioFinanceStatus,
  NumerarioOverride,
} from '../types/comex';
import {
  calculateBrazilianImportTaxes,
  resolveDefaultNcmTaxRates,
} from '../utils/comexEngine';
import { formatCurrency } from '../utils/sapParser';
import { useI18n } from '../i18n/I18nContext';
import { fmt } from '../i18n/translations';
import { translateModal } from '../i18n/helpers';
import { StatusBadge } from './StatusBadge';

export const REGIME_BADGE: Record<
  NumerarioCostLine['taxRegime'],
  { label: string; tone: 'emerald' | 'amber' | 'rose' | 'cyan' }
> = {
  DRAWBACK_SUSP: { label: 'Drawback Suspensão', tone: 'emerald' },
  AGUARDANDO_AC: { label: 'Aguardando AC (Pre-DI)', tone: 'amber' },
  RECOLHIMENTO_INTEGRAL: { label: 'Recolhimento Integral', tone: 'cyan' },
};

export const SOURCE_BADGE: Record<
  NumerarioCostLine['sourceType'],
  { label: string; tone: 'emerald' | 'amber' | 'slate' }
> = {
  SAP_DI: { label: 'SAP Recorded DI', tone: 'emerald' },
  DRAWBACK_SUSPENDED: { label: 'Drawback AC (SAP)', tone: 'slate' },
  PRE_DI_SAP: { label: 'Pre-DI (Uploaded SAP)', tone: 'amber' },
  SIMULATED: { label: 'Simulated (Manual)', tone: 'amber' },
};

export const FINANCE_STATUS_BADGE: Record<
  NumerarioFinanceStatus,
  { label: string; tone: 'slate' | 'amber' | 'cyan' | 'emerald' }
> = {
  DRAFT: { label: 'Pre-Request', tone: 'slate' },
  REQUESTED: { label: 'Requested to Finance', tone: 'amber' },
  APPROVED: { label: 'Approved / Ready', tone: 'cyan' },
  PAID: { label: 'Settled / Paid', tone: 'emerald' },
};

interface NumerarioDetailDrawerProps {
  line: NumerarioCostLine | null;
  currentOverride?: NumerarioOverride;
  onClose: () => void;
  onSaveOverride: (id: string, next: NumerarioOverride | null) => void;
  onSelectProcess: (ref: string) => void;
}

export const NumerarioDetailDrawer: React.FC<NumerarioDetailDrawerProps> = ({
  line,
  currentOverride,
  onClose,
  onSaveOverride,
  onSelectProcess,
}) => {
  const { lang, tr } = useI18n();
  const [regimeDraft, setRegimeDraft] = useState<'AUTO' | 'RECOLHIMENTO_INTEGRAL' | 'DRAWBACK_SUSP'>('AUTO');
  const [iiRateDraft, setIiRateDraft] = useState('12');
  const [ipiRateDraft, setIpiRateDraft] = useState('5');
  const [pisRateDraft, setPisRateDraft] = useState('2.1');
  const [cofinsRateDraft, setCofinsRateDraft] = useState('9.65');
  const [icmsRateDraft, setIcmsRateDraft] = useState('18');
  const [siscomexDraft, setSiscomexDraft] = useState('185');
  const [valorAdtDraft, setValorAdtDraft] = useState('0');
  const [requestDateDraft, setRequestDateDraft] = useState('');
  const [financeStatusDraft, setFinanceStatusDraft] = useState<NumerarioFinanceStatus>('DRAFT');
  const [noteDraft, setNoteDraft] = useState('');
  const [ratesDirty, setRatesDirty] = useState(false);

  useEffect(() => {
    if (!line) return;
    setRegimeDraft(currentOverride?.regimeOverride || 'AUTO');
    setIiRateDraft(String(currentOverride?.iiRatePct ?? line.iiRatePct));
    setIpiRateDraft(String(currentOverride?.ipiRatePct ?? line.ipiRatePct));
    setPisRateDraft(String(currentOverride?.pisRatePct ?? line.pisRatePct));
    setCofinsRateDraft(String(currentOverride?.cofinsRatePct ?? line.cofinsRatePct));
    setIcmsRateDraft(String(currentOverride?.icmsRatePct ?? line.icmsRatePct));
    setSiscomexDraft(String(currentOverride?.siscomexBrl ?? line.siscomexBrl));
    setValorAdtDraft(String(currentOverride?.valorAdtOverride ?? line.valorAdiantadoBrl));
    setRequestDateDraft(
      currentOverride?.numerarioDateOverride ??
        (line.numerarioRequestDate !== '-' ? line.numerarioRequestDate : '')
    );
    setFinanceStatusDraft(currentOverride?.financeStatus ?? line.financeStatus);
    setNoteDraft(currentOverride?.financeNote ?? line.financeNote ?? '');
    setRatesDirty(false);
  }, [line, currentOverride]);

  useEffect(() => {
    if (!line) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [line, onClose]);

  if (!line) return null;

  const regimeMeta = REGIME_BADGE[line.taxRegime];
  const sourceMeta = SOURCE_BADGE[line.sourceType];
  const finMeta = FINANCE_STATUS_BADGE[line.financeStatus];
  const regimeLabel = tr.numerario.regimes[line.taxRegime];
  const sourceLabel = tr.numerario.sources[line.sourceType];
  const finLabel = tr.numerario.finStatus[line.financeStatus];

  const isSimulatedDbk =
    regimeDraft === 'DRAWBACK_SUSP' ||
    (regimeDraft === 'AUTO' && line.taxRegime === 'DRAWBACK_SUSP');

  const previewTotalTaxes = !ratesDirty
    ? line.totalTaxesBrl
    : isSimulatedDbk
      ? Number(siscomexDraft) || 0
      : calculateBrazilianImportTaxes({
          valorAduaneiroBrl: line.valorAduaneiroBrl,
          iiRatePct: Number(iiRateDraft) || 0,
          ipiRatePct: Number(ipiRateDraft) || 0,
          pisRatePct: Number(pisRateDraft) || 0,
          cofinsRatePct: Number(cofinsRateDraft) || 0,
          icmsRatePct: Number(icmsRateDraft) || 0,
          siscomexBrl: Number(siscomexDraft) || 0,
          afrmmBrl: line.afrmmBrl,
        }).totalTaxesBrl;

  const previewTotalNumerario = previewTotalTaxes + line.totalClearanceExpensesBrl;
  const previewSaldo = previewTotalNumerario - (Number(valorAdtDraft) || 0);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveOverride(line.id, {
      regimeOverride: regimeDraft,
      ...(ratesDirty || currentOverride?.iiRatePct !== undefined
        ? {
            iiRatePct: Number(iiRateDraft) || 0,
            ipiRatePct: Number(ipiRateDraft) || 0,
            pisRatePct: Number(pisRateDraft) || 0,
            cofinsRatePct: Number(cofinsRateDraft) || 0,
            icmsRatePct: Number(icmsRateDraft) || 0,
            siscomexBrl: Number(siscomexDraft) || 0,
          }
        : {}),
      valorAdtOverride: Number(valorAdtDraft) || 0,
      numerarioDateOverride: requestDateDraft.trim() || '-',
      financeStatus: financeStatusDraft,
      financeNote: noteDraft.trim(),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={fmt(tr.numerario.drawer.ariaLabel, { id: line.id })}
    >
      <div
        className="w-full max-w-4xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto p-6 shadow-2xl space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 font-mono font-bold text-cyan-600 dark:text-cyan-400">
                <Calculator className="w-3.5 h-3.5" />
                {line.id}
              </span>
              <StatusBadge label={regimeLabel} tone={regimeMeta.tone} />
              <StatusBadge label={sourceLabel} tone={sourceMeta.tone} />
              <StatusBadge label={finLabel} tone={finMeta.tone} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {line.supplier} · {line.pepProject}
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
              <span>PO: {line.poList}</span>
              <span>DI: {line.diNum}</span>
              <span>NCM: {line.ncms}</span>
              {line.acNumber !== '-' && <span>AC: {line.acNumber}</span>}
              <span>
                {translateModal(line.modal, lang)} · {line.incoterm} · PTAX {line.ptax.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {line.kind === 'SHIPMENT' && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectProcess(line.processRef);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                {tr.numerario.drawer.openShipment}
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={tr.numerario.drawer.closeAria}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{tr.numerario.drawer.vaLabel}</div>
            <div className="mt-1 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(line.valorAduaneiroBrl, 'BRL')}
            </div>
            <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-500">
              FOB {formatCurrency(line.fobOrig, line.currency)}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{tr.numerario.drawer.taxesLabel}</div>
            <div className="mt-1 text-sm font-bold font-mono tabular-nums text-cyan-700 dark:text-cyan-300">
              {formatCurrency(line.totalTaxesBrl, 'BRL')}
            </div>
            <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-500">
              {tr.numerario.drawer.taxesFormula}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{tr.numerario.drawer.totalNumerarioLabel}</div>
            <div className="mt-1 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(line.totalNumerarioBrl, 'BRL')}
            </div>
            <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-500">
              {fmt(tr.numerario.drawer.advancedSub, { val: formatCurrency(line.valorAdiantadoBrl, 'BRL') })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{tr.numerario.drawer.saldoLabel}</div>
            <div
              className={`mt-1 text-sm font-bold font-mono tabular-nums ${
                line.saldoFinanceiroBrl > 50
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {formatCurrency(line.saldoFinanceiroBrl, 'BRL')}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {line.saldoFinanceiroBrl > 50
                ? tr.numerario.drawer.transferNeeded
                : tr.numerario.drawer.coveredCredit}
            </div>
          </div>
        </div>

        {/* Drawback Alert or Savings Banner */}
        {line.taxRegime === 'AGUARDANDO_AC' && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">{tr.numerario.drawer.pendingAcAlertTitle}</span>{' '}
              {line.potentialDrawbackSavingsBrl > 0
                ? fmt(tr.numerario.drawer.pendingAcExposure, {
                    val: formatCurrency(line.potentialDrawbackSavingsBrl, 'BRL'),
                  })
                : tr.numerario.drawer.pendingAcZeroNote}
            </div>
          </div>
        )}

        {line.taxRegime === 'DRAWBACK_SUSP' && line.potentialDrawbackSavingsBrl > 0 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-800 dark:text-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">
                {fmt(tr.numerario.drawer.dbkActiveTitle, { ac: line.acNumber })}
              </span>{' '}
              {fmt(tr.numerario.drawer.dbkActiveBody, {
                val: formatCurrency(line.potentialDrawbackSavingsBrl, 'BRL'),
              })}
            </div>
          </div>
        )}

        {/* Two-Column Cost Waterfall */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                {tr.numerario.drawer.taxWaterfallTitle}
              </h4>
            </div>
            <div className="p-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>{tr.numerario.drawer.vaBaseLine}</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(line.valorAduaneiroBrl, 'BRL')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{fmt(tr.numerario.drawer.iiLine, { rate: line.iiRatePct })}</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                  {formatCurrency(line.iiBrl, 'BRL')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{fmt(tr.numerario.drawer.ipiLine, { rate: line.ipiRatePct })}</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                  {formatCurrency(line.ipiBrl, 'BRL')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{fmt(tr.numerario.drawer.pisLine, { rate: line.pisRatePct })}</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                  {formatCurrency(line.pisBrl, 'BRL')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{fmt(tr.numerario.drawer.cofinsLine, { rate: line.cofinsRatePct })}</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                  {formatCurrency(line.cofinsBrl, 'BRL')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{fmt(tr.numerario.drawer.icmsLine, { rate: line.icmsRatePct })}</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                  {formatCurrency(line.icmsBrl, 'BRL')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{tr.numerario.drawer.siscomexLine}</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                  {formatCurrency(line.siscomexBrl, 'BRL')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{tr.numerario.drawer.afrmmLine}</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                  {formatCurrency(line.afrmmBrl, 'BRL')}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-bold text-slate-900 dark:text-white">
                <span>{tr.numerario.drawer.subtotalTaxes}</span>
                <span className="font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                  {formatCurrency(line.totalTaxesBrl, 'BRL')}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                {tr.numerario.drawer.clearanceTitle}
              </h4>
            </div>
            <div className="p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span>{tr.numerario.drawer.storageLine}</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                  {formatCurrency(line.armazenagemBrl, 'BRL')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{tr.numerario.drawer.capataziaLine}</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                  {formatCurrency(line.capataziaBrl, 'BRL')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{tr.numerario.drawer.brokerageLine}</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                  {formatCurrency(line.brokerFeeBrl, 'BRL')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{tr.numerario.drawer.liLine}</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                  {formatCurrency(line.liFeeBrl, 'BRL')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{tr.numerario.drawer.ecotaxLine}</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                  {formatCurrency(line.ecotaxBrl, 'BRL')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{tr.numerario.drawer.truckingLine}</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                  {formatCurrency(line.freteNacionalBrl, 'BRL')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{tr.numerario.drawer.demurrageLine}</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                  {formatCurrency(line.demurrageBrl, 'BRL')}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-bold text-slate-900 dark:text-white">
                <span>{tr.numerario.drawer.subtotalClearance}</span>
                <span className="font-mono tabular-nums text-amber-600 dark:text-amber-400">
                  {formatCurrency(line.totalClearanceExpensesBrl, 'BRL')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Finance Numerário Simulator & Override Form */}
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                {tr.numerario.drawer.simTitle}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {tr.numerario.drawer.simSubtitle}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const defaults = resolveDefaultNcmTaxRates(line.ncms);
                  setIiRateDraft(String(defaults.ii));
                  setIpiRateDraft(String(defaults.ipi));
                  setPisRateDraft(String(defaults.pis));
                  setCofinsRateDraft(String(defaults.cofins));
                  setIcmsRateDraft(String(defaults.icms));
                  setRatesDirty(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <Calculator className="w-3 h-3" />
                {tr.numerario.drawer.loadNcmRates}
              </button>
              {line.hasOverride && (
                <button
                  type="button"
                  onClick={() => {
                    onSaveOverride(line.id, null);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 whitespace-nowrap"
                >
                  <RotateCcw className="w-3 h-3" />
                  {tr.numerario.drawer.resetAutoSap}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            <div className="col-span-2 sm:col-span-2 lg:col-span-2">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                {tr.numerario.drawer.regimeMode}
              </label>
              <select
                aria-label={tr.numerario.drawer.regimeMode}
                value={regimeDraft}
                onChange={(e) => {
                  setRegimeDraft(
                    e.target.value as 'AUTO' | 'RECOLHIMENTO_INTEGRAL' | 'DRAWBACK_SUSP'
                  );
                  setRatesDirty(true);
                }}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="AUTO">{tr.numerario.drawer.modeAuto}</option>
                <option value="RECOLHIMENTO_INTEGRAL">{tr.numerario.drawer.modeFullTax}</option>
                <option value="DRAWBACK_SUSP">{tr.numerario.drawer.modeDrawback}</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                II (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={iiRateDraft}
                onChange={(e) => {
                  setIiRateDraft(e.target.value);
                  setRatesDirty(true);
                }}
                disabled={isSimulatedDbk}
                className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                IPI (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={ipiRateDraft}
                onChange={(e) => {
                  setIpiRateDraft(e.target.value);
                  setRatesDirty(true);
                }}
                disabled={isSimulatedDbk}
                className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                PIS (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={pisRateDraft}
                onChange={(e) => {
                  setPisRateDraft(e.target.value);
                  setRatesDirty(true);
                }}
                disabled={isSimulatedDbk}
                className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                COFINS (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={cofinsRateDraft}
                onChange={(e) => {
                  setCofinsRateDraft(e.target.value);
                  setRatesDirty(true);
                }}
                disabled={isSimulatedDbk}
                className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                ICMS (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={icmsRateDraft}
                onChange={(e) => {
                  setIcmsRateDraft(e.target.value);
                  setRatesDirty(true);
                }}
                disabled={isSimulatedDbk}
                className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                {tr.numerario.drawer.siscomexInput}
              </label>
              <input
                type="number"
                step="0.01"
                value={siscomexDraft}
                onChange={(e) => {
                  setSiscomexDraft(e.target.value);
                  setRatesDirty(true);
                }}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                {tr.numerario.drawer.valorAdtInput}
              </label>
              <input
                type="number"
                step="0.01"
                value={valorAdtDraft}
                onChange={(e) => setValorAdtDraft(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                {tr.numerario.drawer.reqDateInput}
              </label>
              <input
                type="text"
                value={requestDateDraft}
                onChange={(e) => setRequestDateDraft(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                {tr.numerario.drawer.finStatusInput}
              </label>
              <select
                aria-label={tr.numerario.drawer.finStatusInput}
                value={financeStatusDraft}
                onChange={(e) => setFinanceStatusDraft(e.target.value as NumerarioFinanceStatus)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="DRAFT">{tr.numerario.finStatus.DRAFT}</option>
                <option value="REQUESTED">{tr.numerario.finStatus.REQUESTED}</option>
                <option value="APPROVED">{tr.numerario.finStatus.APPROVED}</option>
                <option value="PAID">{tr.numerario.finStatus.PAID}</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex-1 min-w-[220px]">
              <input
                type="text"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder={tr.numerario.drawer.notePlaceholder}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right text-[11px] font-mono tabular-nums">
                <span className="text-slate-500">{tr.numerario.drawer.previewTotal} </span>
                <strong className="text-slate-900 dark:text-white">
                  {formatCurrency(previewTotalNumerario, 'BRL')}
                </strong>
                <span className="text-slate-400 mx-1.5">·</span>
                <span className="text-slate-500">{tr.numerario.drawer.previewSaldo} </span>
                <strong
                  className={
                    previewSaldo > 50
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }
                >
                  {formatCurrency(previewSaldo, 'BRL')}
                </strong>
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                {tr.numerario.drawer.saveBtn}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

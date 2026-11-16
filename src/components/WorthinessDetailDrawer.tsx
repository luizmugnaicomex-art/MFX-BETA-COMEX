import React, { useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Plane,
  ShieldAlert,
  Ship,
  X,
} from 'lucide-react';
import type { ShipmentCostBenefitRow } from '../types/comex';
import { formatCurrency } from '../utils/sapParser';
import { useI18n } from '../i18n/I18nContext';
import { fmt } from '../i18n/translations';
import {
  translateAirHeadline,
  translateAirRationale,
  translateChannel,
  translateModal,
  translateRecommendation,
  translateTroubleSignal,
} from '../i18n/helpers';
import { StatusBadge } from './StatusBadge';

export const VERDICT_META: Record<
  ShipmentCostBenefitRow['worthinessVerdict'],
  { label: string; tone: 'emerald' | 'amber' | 'rose' }
> = {
  EFFICIENT: { label: 'Worth It / Efficient', tone: 'emerald' },
  REVIEW: { label: 'Borderline / Review', tone: 'amber' },
  NOT_WORTH_IT: { label: 'Cost Overrun / Avoid', tone: 'rose' },
};

export const AIR_VERDICT_META: Record<
  ShipmentCostBenefitRow['airEvaluation']['verdict'],
  { label: string; tone: 'emerald' | 'amber' | 'rose' | 'slate' }
> = {
  JUSTIFIED_AIR: { label: 'Air Justified', tone: 'emerald' },
  QUESTIONABLE_AIR: { label: 'Air Borderline', tone: 'amber' },
  AVOIDABLE_AIR: { label: 'Air Speed Wasted', tone: 'rose' },
  NOT_APPLICABLE: { label: 'Sea / Road', tone: 'slate' },
};

const PRIORITY_TONE: Record<'HIGH' | 'MEDIUM' | 'LOW', 'rose' | 'amber' | 'cyan'> = {
  HIGH: 'rose',
  MEDIUM: 'amber',
  LOW: 'cyan',
};

interface WorthinessDetailDrawerProps {
  row: ShipmentCostBenefitRow | null;
  onClose: () => void;
  onOpenShipmentWorkbench: (ref: string) => void;
}

export const WorthinessDetailDrawer: React.FC<WorthinessDetailDrawerProps> = ({
  row,
  onClose,
  onOpenShipmentWorkbench,
}) => {
  const { lang, tr } = useI18n();

  useEffect(() => {
    if (!row) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [row, onClose]);

  if (!row) return null;

  const verdictMeta = VERDICT_META[row.worthinessVerdict];
  const airMeta = AIR_VERDICT_META[row.airEvaluation.verdict];
  const verdictLabel = tr.worth.verdicts[row.worthinessVerdict];
  const airLabel = tr.worth.airVerdicts[row.airEvaluation.verdict];

  const costBreakdownLines: Array<{ label: string; valueBrl: number; highlight?: boolean }> = [
    { label: tr.worth.drawer.lineIntlFreight, valueBrl: row.intlFreightBrl },
    { label: tr.worth.drawer.lineInsurance, valueBrl: row.insuranceBrl },
    {
      label: fmt(tr.worth.drawer.lineStorage, { days: row.daysInPort, periods: row.periodos }),
      valueBrl: row.storageBrl,
      highlight: row.periodos >= 2 && row.storageBrl > 0,
    },
    { label: tr.worth.drawer.lineCapatazia, valueBrl: row.capataziaBrl },
    { label: tr.worth.drawer.lineAfrmm, valueBrl: row.afrmmBrl },
    { label: tr.worth.drawer.lineTrucking, valueBrl: row.truckingBrl },
    {
      label: tr.worth.drawer.lineBrokerFees,
      valueBrl: row.brokerFeeBrl + row.liFeeBrl + row.ecotaxBrl,
    },
    {
      label: tr.worth.drawer.lineDemurrage,
      valueBrl: row.demurrageBrl,
      highlight: row.demurrageBrl > 0,
    },
    { label: tr.worth.drawer.lineCustomsTaxes, valueBrl: row.customsTaxesBrl },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={fmt(tr.worth.drawer.auditAria, { ref: row.ref })}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-bold text-base text-cyan-700 dark:text-cyan-300">
                {row.ref}
              </span>
              <StatusBadge label={verdictLabel} tone={verdictMeta.tone} />
              <StatusBadge label={airLabel} tone={airMeta.tone} />
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 truncate">
              {row.exporter} · PO {row.poList} · {row.pepProject}
            </p>
            <p className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {translateModal(row.modal, lang)} / {row.incoterm} ·{' '}
              {fmt(tr.worth.drawer.channelLabel, { canal: translateChannel(row.canal, lang) })} · ETD{' '}
              {row.etd} · ETA {row.eta}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onOpenShipmentWorkbench(row.ref);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {tr.worth.drawer.workbenchBtn}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={tr.worth.drawer.closeAria}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Executive Order vs Total Cost Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950 rounded-xl p-3.5">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {tr.worth.drawer.orderFob}
              </div>
              <div className="mt-1 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(row.fobBrl, 'BRL')}
              </div>
              <div className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                VA: {formatCurrency(row.cifBrl, 'BRL')}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {tr.worth.drawer.totalExtraCost}
              </div>
              <div className="mt-1 text-sm font-bold font-mono tabular-nums text-amber-600 dark:text-amber-300">
                {formatCurrency(row.totalExtraCostBrl, 'BRL')}
              </div>
              <div className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                +{row.totalExtraPctOverFob}% {tr.worth.overFob}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {tr.worth.drawer.totalLandedCost}
              </div>
              <div className="mt-1 text-sm font-bold font-mono tabular-nums text-cyan-700 dark:text-cyan-300">
                {formatCurrency(row.totalLandedBrl, 'BRL')}
              </div>
              <div className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {fmt(tr.worth.drawer.multiplierFob, { mult: row.landedMultiplier.toFixed(2) })}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {tr.worth.drawer.observedWaste}
              </div>
              <div
                className={`mt-1 text-sm font-bold font-mono tabular-nums ${
                  row.observedAvoidableWasteBrl > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {formatCurrency(row.observedAvoidableWasteBrl, 'BRL')}
              </div>
              <div className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {tr.worth.drawer.wastePeriodHint}
              </div>
            </div>
          </div>

          {/* Air vs Sea Modal Evaluation */}
          <div className="rounded-xl p-4 bg-slate-50 dark:bg-slate-950 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                {row.airEvaluation.isAir ? (
                  <Plane className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                ) : (
                  <Ship className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                )}
                <span>
                  {row.airEvaluation.isAir
                    ? tr.worth.drawer.airTitle
                    : tr.worth.drawer.seaTitle}
                </span>
              </div>
              <StatusBadge label={airLabel} tone={airMeta.tone} />
            </div>
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
              {translateAirHeadline(row.airEvaluation, row.modal, lang)}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {translateAirRationale(
                row.airEvaluation,
                row.modal,
                lang,
                row.periodos,
                row.status,
                row.maxOrderDelayDays,
                row.transitTime
              )}
            </p>
            <div className="pt-1 flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              <span>{fmt(tr.worth.drawer.freightFobStat, { pct: row.airEvaluation.freightPctOverFob })}</span>
              <span>{fmt(tr.worth.drawer.dwellStat, { days: row.airEvaluation.airportDwellDays })}</span>
              <span>{fmt(tr.worth.drawer.stockCovStat, { pct: row.airEvaluation.stockCoveragePct })}</span>
              <span>{fmt(tr.worth.drawer.maxDelayStat, { days: row.maxOrderDelayDays })}</span>
            </div>
          </div>

          {/* Exact SAP Cost Component Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {tr.worth.drawer.breakdownTitle}
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {tr.worth.drawer.strictSapHint}
              </span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {costBreakdownLines.map((line) => (
                <div
                  key={line.label}
                  className="px-3.5 py-2 flex items-center justify-between text-xs bg-white dark:bg-slate-900"
                >
                  <span
                    className={
                      line.highlight
                        ? 'font-medium text-rose-600 dark:text-rose-400'
                        : 'text-slate-700 dark:text-slate-300'
                    }
                  >
                    {line.label}
                  </span>
                  <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                    {formatCurrency(line.valueBrl, 'BRL')}
                  </span>
                </div>
              ))}
              <div className="px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
                <span>{tr.worth.drawer.totalNonProduct}</span>
                <span className="font-mono tabular-nums text-amber-600 dark:text-amber-300">
                  {formatCurrency(row.totalExtraCostBrl, 'BRL')} (+{row.totalExtraPctOverFob}%)
                </span>
              </div>
            </div>
          </div>

          {/* Recurring SKU Trouble History */}
          {row.itemTroubleSummary.troubleSignals.length > 0 && (
            <div className="rounded-xl p-4 bg-rose-500/5 border border-rose-500/20 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{tr.worth.drawer.troubleHistoryTitle}</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                {fmt(tr.worth.drawer.troubleHistorySummary, {
                  late: row.itemTroubleSummary.lateOrderCount,
                  total: row.itemTroubleSummary.totalHistoricalOrders,
                  air: row.itemTroubleSummary.repeatAirCount,
                  days: row.itemTroubleSummary.historicalDelayAvgDays,
                })}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {row.itemTroubleSummary.troubleSignals.map((sig) => (
                  <span
                    key={sig}
                    className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[11px] font-medium"
                  >
                    {translateTroubleSignal(sig, lang)}
                  </span>
                ))}
              </div>
              {row.itemTroubleSummary.affectedMaterials.length > 0 && (
                <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 pt-1">
                  {row.itemTroubleSummary.affectedMaterials.map((m) => (
                    <li key={m} className="truncate font-mono">
                      • {m}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Actionable Cost-Avoidance Playbook for Future Orders */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {tr.worth.drawer.solutionsTitle}
            </h3>
            {row.recommendations.length === 0 ? (
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{tr.worth.drawer.cleanExecution}</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {row.recommendations.map((rec) => {
                  const tRec = translateRecommendation(rec, row, lang);
                  return (
                    <div
                      key={rec.code}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>{tRec.title}</span>
                        </div>
                        <StatusBadge
                          label={tr.worth.priority[rec.priority]}
                          tone={PRIORITY_TONE[rec.priority]}
                        />
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {tRec.detail}
                      </p>
                      {rec.observedWasteBrl > 0 && (
                        <div className="text-[11px] font-mono tabular-nums text-rose-600 dark:text-rose-400">
                          {fmt(tr.worth.drawer.observedWasteLinked, {
                            val: formatCurrency(rec.observedWasteBrl, 'BRL'),
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

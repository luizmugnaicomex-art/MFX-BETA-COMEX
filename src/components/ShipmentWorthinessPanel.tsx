import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Plane,
  Scale,
  Search,
  ShieldAlert,
  TrendingDown,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  FupItemRow,
  MaterialTroubleProfile,
  ShipmentCostBenefitRow,
  ShipmentProcessRow,
  ShipmentWorthinessVerdict,
} from '../types/comex';
import { buildShipmentWorthinessAnalysis } from '../utils/comexEngine';
import {
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
  formatAxisBrl,
  formatCompactBrl,
} from '../utils/chartFormatters';
import { formatCurrency } from '../utils/sapParser';
import {
  exportWorthinessPdf,
  exportWorthinessWorkbook,
} from '../utils/exportReports';
import { useI18n } from '../i18n/I18nContext';
import { fmt } from '../i18n/translations';
import {
  translateChannel,
  translateFutureFix,
  translateModal,
  translateRecommendation,
  translateTroubleSignal,
  translateWorthinessReason,
} from '../i18n/helpers';
import { StatusBadge } from './StatusBadge';
import {
  AIR_VERDICT_META,
  VERDICT_META,
  WorthinessDetailDrawer,
} from './WorthinessDetailDrawer';

interface ShipmentWorthinessPanelProps {
  processes: ShipmentProcessRow[];
  items: FupItemRow[];
  allItems: FupItemRow[];
  onSelectProcess: (ref: string) => void;
}

type AuditSubView = 'shipments' | 'troubles';

const SEVERITY_TONE: Record<MaterialTroubleProfile['severity'], 'rose' | 'amber' | 'emerald'> = {
  HIGH: 'rose',
  MEDIUM: 'amber',
  LOW: 'emerald',
};

export const ShipmentWorthinessPanel: React.FC<ShipmentWorthinessPanelProps> = ({
  processes,
  items,
  allItems,
  onSelectProcess,
}) => {
  const { lang, tr } = useI18n();
  const [subView, setSubView] = useState<AuditSubView>('shipments');
  const [verdictFilter, setVerdictFilter] = useState<'ALL' | ShipmentWorthinessVerdict>('ALL');
  const [modalFilter, setModalFilter] = useState<'ALL' | 'AIR' | 'SEA_ROAD'>('ALL');
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [troubleSeverityFilter, setTroubleSeverityFilter] = useState<'ALL' | 'PROBLEMS' | 'HIGH'>('PROBLEMS');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRef, setSelectedRef] = useState<string | null>(null);

  const analysis = useMemo(
    () => buildShipmentWorthinessAnalysis(processes, items, allItems),
    [processes, items, allItems]
  );

  const wasteDriversChart = useMemo(
    () =>
      analysis.chartWasteDrivers.map((d) => ({
        ...d,
        name:
          tr.worth.wasteDrivers[d.key as keyof typeof tr.worth.wasteDrivers] || d.name,
      })),
    [analysis.chartWasteDrivers, tr]
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return analysis.rows.filter((r) => {
      if (verdictFilter !== 'ALL' && r.worthinessVerdict !== verdictFilter) return false;
      if (modalFilter === 'AIR' && !r.airEvaluation.isAir) return false;
      if (modalFilter === 'SEA_ROAD' && r.airEvaluation.isAir) return false;
      if (
        issuesOnly &&
        r.worthinessVerdict === 'EFFICIENT' &&
        !r.itemTroubleSummary.hasRecurringTrouble &&
        r.airEvaluation.verdict !== 'AVOIDABLE_AIR' &&
        r.airEvaluation.verdict !== 'QUESTIONABLE_AIR'
      ) {
        return false;
      }
      if (q) {
        const hay = [
          r.ref,
          r.poList,
          r.exporter,
          r.pepProject,
          r.modal,
          r.incoterm,
          r.airEvaluation.headline,
          ...r.worthinessReasons,
          ...r.itemTroubleSummary.affectedMaterials,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [analysis.rows, verdictFilter, modalFilter, issuesOnly, searchQuery]);

  const filteredTroubles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return analysis.materialTroubles.filter((m) => {
      if (troubleSeverityFilter === 'HIGH' && m.severity !== 'HIGH') return false;
      if (
        troubleSeverityFilter === 'PROBLEMS' &&
        m.troubleSignals.length === 0 &&
        m.severity === 'LOW'
      ) {
        return false;
      }
      if (q) {
        const hay = [
          m.materialCode,
          m.descPt,
          m.descEn,
          m.ncm,
          m.primarySupplier,
          m.recommendedFutureFix,
          ...m.troubleSignals,
          ...m.linkedProcesses,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [analysis.materialTroubles, troubleSeverityFilter, searchQuery]);

  const selectedRow: ShipmentCostBenefitRow | null = useMemo(
    () => analysis.rows.find((r) => r.ref === selectedRef) || null,
    [analysis.rows, selectedRef]
  );

  const chartProcessData = useMemo(
    () =>
      filteredRows.slice(0, 8).map((r) => ({
        name: r.ref.replace('MFX-000', 'MFX-').replace('MFX-00', 'MFX-'),
        processRef: r.ref,
        fobBrl: Math.round(r.fobBrl),
        logisticsBrl: Math.round(r.totalLogisticsCostBrl),
        taxesBrl: Math.round(r.customsTaxesBrl),
        extraBrl: Math.round(r.totalExtraCostBrl),
        extraLabel: `+${r.totalExtraPctOverFob}%`,
      })),
    [filteredRows]
  );

  const exportPayload = useMemo(
    () => ({
      ...analysis,
      rows: filteredRows,
      materialTroubles: filteredTroubles,
    }),
    [analysis, filteredRows, filteredTroubles]
  );

  return (
    <div className="space-y-5">
      {/* Director Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr.worth.kpiFobVsExtraTitle}</span>
            <Scale className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            +{analysis.summary.weightedExtraPctOverFob}%{' '}
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {tr.worth.overFob}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span>FOB: {formatCompactBrl(analysis.summary.totalFobBrl, true)}</span>
            <span>Extra: {formatCompactBrl(analysis.summary.totalExtraCostBrl, true)}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr.worth.kpiVerdictTitle}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
              {analysis.summary.notWorthItCount}
            </span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {tr.worth.costOverruns}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span>{fmt(tr.worth.reviewCount, { count: analysis.summary.reviewCount })}</span>
            <span>{fmt(tr.worth.efficientCount, { count: analysis.summary.efficientCount })}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr.worth.kpiAirRoiTitle}</span>
            <Plane className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-300">
              {analysis.summary.questionableOrAvoidableAirCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {fmt(tr.worth.airFlagged, { total: analysis.summary.airShipmentCount })}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span>
              {fmt(tr.worth.justifiedAirCount, { count: analysis.summary.justifiedAirCount })}
            </span>
            <span>
              {fmt(tr.worth.logFobPct, { pct: analysis.summary.weightedLogisticsPctOverFob })}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr.worth.kpiWasteTitle}</span>
            <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            {formatCurrency(analysis.summary.observedAvoidableWasteBrl, 'BRL')}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span>{tr.worth.excessStorageDem}</span>
            <span>
              {fmt(tr.worth.troubledSkus, { count: analysis.summary.recurringTroubleSkuCount })}
            </span>
          </div>
        </div>
      </div>

      {/* Director Visual Comparison Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {tr.worth.chartCompareTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tr.worth.chartCompareSubtitle}
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {fmt(tr.worth.landedShort, {
                val: formatCompactBrl(analysis.summary.totalLandedBrl, true),
              })}
            </span>
          </div>
          <div className="h-[245px] text-slate-700 dark:text-slate-200">
            {chartProcessData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                {tr.worth.emptyChart}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartProcessData}
                  margin={{ top: 20, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={(v) => formatAxisBrl(Number(v))}
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                    width={64}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    formatter={(val, name) => [formatCurrency(Number(val), 'BRL'), String(name)]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar
                    dataKey="fobBrl"
                    name={tr.worth.seriesFob}
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  >
                    <LabelList
                      dataKey="fobBrl"
                      position="top"
                      formatter={(v) => formatAxisBrl(Number(v))}
                      style={{ fill: 'currentColor', fontSize: 10, fontFamily: 'monospace' }}
                    />
                  </Bar>
                  <Bar
                    dataKey="logisticsBrl"
                    stackId="extra"
                    name={tr.worth.seriesLogistics}
                    fill="#06b6d4"
                  />
                  <Bar
                    dataKey="taxesBrl"
                    stackId="extra"
                    name={tr.worth.seriesTaxes}
                    fill="#8b5cf6"
                    radius={[4, 4, 0, 0]}
                  >
                    <LabelList
                      dataKey="extraLabel"
                      position="top"
                      style={{ fill: '#f59e0b', fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {tr.worth.chartDriversTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tr.worth.chartDriversSubtitle}
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {formatCurrency(analysis.summary.totalExtraCostBrl, 'BRL')}
            </span>
          </div>
          <div className="h-[245px] text-slate-700 dark:text-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={wasteDriversChart}
                layout="vertical"
                margin={{ top: 6, right: 112, left: 6, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => formatAxisBrl(Number(v))}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={136}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  formatter={(val) => [
                    formatCurrency(Number(val), 'BRL'),
                    tr.worth.recordedCostTooltip,
                  ]}
                />
                <Bar dataKey="valueBrl" radius={[0, 4, 4, 0]}>
                  {wasteDriversChart.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                  <LabelList
                    dataKey="valueBrl"
                    position="right"
                    formatter={(v) => formatCompactBrl(Number(v), true)}
                    style={{ fill: 'currentColor', fontSize: 11, fontFamily: 'monospace' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Controls & Sub-View Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-0.5">
            <button
              type="button"
              onClick={() => setSubView('shipments')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subView === 'shipments'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {fmt(tr.worth.subViewShipments, { count: filteredRows.length })}
            </button>
            <button
              type="button"
              onClick={() => setSubView('troubles')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subView === 'troubles'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {fmt(tr.worth.subViewTroubles, { count: filteredTroubles.length })}
            </button>
          </div>

          {subView === 'shipments' ? (
            <>
              <select
                aria-label={tr.worth.verdictFilterAria}
                value={verdictFilter}
                onChange={(e) =>
                  setVerdictFilter(e.target.value as 'ALL' | ShipmentWorthinessVerdict)
                }
                className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="ALL">{tr.worth.allVerdicts}</option>
                <option value="NOT_WORTH_IT">{tr.worth.optNotWorthIt}</option>
                <option value="REVIEW">{tr.worth.optReview}</option>
                <option value="EFFICIENT">{tr.worth.optEfficient}</option>
              </select>

              <select
                aria-label={tr.worth.modalFilterAria}
                value={modalFilter}
                onChange={(e) =>
                  setModalFilter(e.target.value as 'ALL' | 'AIR' | 'SEA_ROAD')
                }
                className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="ALL">{tr.worth.allModals}</option>
                <option value="AIR">{tr.worth.optAirOnly}</option>
                <option value="SEA_ROAD">{tr.worth.optSeaRoad}</option>
              </select>

              <label className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0">
                <input
                  type="checkbox"
                  checked={issuesOnly}
                  onChange={(e) => setIssuesOnly(e.target.checked)}
                  className="accent-cyan-600 rounded"
                />
                <span>{tr.worth.issuesOnly}</span>
              </label>
            </>
          ) : (
            <select
              aria-label={tr.worth.troubleFilterAria}
              value={troubleSeverityFilter}
              onChange={(e) =>
                setTroubleSeverityFilter(e.target.value as 'ALL' | 'PROBLEMS' | 'HIGH')
              }
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="PROBLEMS">{tr.worth.optTroubledOnly}</option>
              <option value="HIGH">{tr.worth.optHighOnly}</option>
              <option value="ALL">{tr.worth.optAllHistory}</option>
            </select>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label={tr.worth.searchAria}
              placeholder={
                subView === 'shipments'
                  ? tr.worth.searchShipmentsPlaceholder
                  : tr.worth.searchTroublesPlaceholder
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white w-40"
            />
          </div>

          <button
            type="button"
            onClick={() => exportWorthinessWorkbook(exportPayload)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            {tr.worth.excelBtn}
          </button>

          <button
            type="button"
            onClick={() => exportWorthinessPdf(exportPayload)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            {tr.worth.pdfBtn}
          </button>
        </div>
      </div>

      {/* Main Audit Table */}
      {subView === 'shipments' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {fmt(tr.worth.tableShipmentsTitle, { count: filteredRows.length })}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tr.worth.tableShipmentsSubtitle}
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {fmt(tr.worth.totalLanded, {
                val: formatCurrency(filteredRows.reduce((s, r) => s + r.totalLandedBrl, 0), 'BRL'),
              })}
            </span>
          </div>

          {filteredRows.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
              {tr.worth.emptyShipments}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3 font-medium">{tr.worth.colProcessSupplier}</th>
                    <th className="py-2.5 px-3 font-medium">{tr.worth.colModalAir}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{tr.worth.colOrderFob}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{tr.worth.colLogisticsPort}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{tr.worth.colStorageDays}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{tr.worth.colTaxesSap}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{tr.worth.colExtraFob}</th>
                    <th className="py-2.5 px-3 font-medium">{tr.worth.colVerdictFix}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredRows.map((row) => {
                    const vMeta = VERDICT_META[row.worthinessVerdict];
                    const aMeta = AIR_VERDICT_META[row.airEvaluation.verdict];
                    const topFixTitle = row.recommendations[0]
                      ? translateRecommendation(row.recommendations[0], row, lang).title
                      : row.worthinessReasons[0]
                        ? translateWorthinessReason(row.worthinessReasons[0], lang)
                        : '';
                    return (
                      <tr
                        key={row.ref}
                        onClick={() => setSelectedRef(row.ref)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-3 align-top">
                          <div className="font-mono font-bold text-cyan-700 dark:text-cyan-300">
                            {row.ref}
                          </div>
                          <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate max-w-[190px]">
                            {row.exporter}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            PO {row.poList} · {row.incoterm}
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge
                              label={tr.worth.airVerdicts[row.airEvaluation.verdict]}
                              tone={aMeta.tone}
                            />
                            {row.itemTroubleSummary.hasRecurringTrouble && (
                              <span
                                title={row.itemTroubleSummary.troubleSignals
                                  .map((sig) => translateTroubleSignal(sig, lang))
                                  .join(', ')}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-medium"
                              >
                                <ShieldAlert className="w-3 h-3" />
                                {tr.worth.skuTroubleBadge}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 max-w-[200px]">
                            {row.airEvaluation.isAir
                              ? fmt(tr.worth.freightStockSub, {
                                  frt: row.airEvaluation.freightPctOverFob,
                                  stk: row.airEvaluation.stockCoveragePct,
                                })
                              : `${translateModal(row.modal, lang)} · ${fmt(
                                  tr.worth.channelShort,
                                  { canal: translateChannel(row.canal, lang) }
                                )}`}
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top text-right font-mono tabular-nums">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(row.fobBrl, 'BRL')}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {fmt(tr.worth.landedMult, { mult: row.landedMultiplier.toFixed(2) })}
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top text-right font-mono tabular-nums">
                          <div className="text-slate-900 dark:text-white">
                            {formatCurrency(row.totalLogisticsCostBrl, 'BRL')}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {fmt(tr.worth.pctOfFob, { pct: row.logisticsPctOverFob })}
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top text-right font-mono tabular-nums">
                          <div
                            className={
                              row.periodos >= 2 || row.demurrageBrl > 0
                                ? 'font-semibold text-rose-600 dark:text-rose-400'
                                : 'text-slate-900 dark:text-white'
                            }
                          >
                            {formatCurrency(row.storageBrl + row.demurrageBrl, 'BRL')}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {row.daysInPort}d · {row.periodos}p
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top text-right font-mono tabular-nums">
                          <div className="text-slate-900 dark:text-white">
                            {formatCurrency(row.customsTaxesBrl, 'BRL')}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {fmt(tr.worth.pctFobShort, { pct: row.taxesPctOverFob })}
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top text-right font-mono tabular-nums">
                          <div
                            className={`font-bold ${
                              row.totalExtraPctOverFob >= 45
                                ? 'text-rose-600 dark:text-rose-400'
                                : row.totalExtraPctOverFob >= 25
                                  ? 'text-amber-600 dark:text-amber-300'
                                  : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            +{row.totalExtraPctOverFob}%
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {formatCurrency(row.totalExtraCostBrl, 'BRL')}
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top max-w-[270px]">
                          <div className="flex items-center gap-1.5">
                            <StatusBadge
                              label={tr.worth.verdicts[row.worthinessVerdict]}
                              tone={vMeta.tone}
                            />
                            {row.observedAvoidableWasteBrl > 0 && (
                              <span className="text-[10px] font-mono tabular-nums text-rose-600 dark:text-rose-400">
                                {fmt(tr.worth.wasteCompact, {
                                  val: formatCompactBrl(row.observedAvoidableWasteBrl, true),
                                })}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                            {topFixTitle}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Recurring SKU Trouble History & Future Prevention Playbook */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {fmt(tr.worth.tableTroublesTitle, { count: filteredTroubles.length })}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tr.worth.tableTroublesSubtitle}
              </p>
            </div>
          </div>

          {filteredTroubles.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
              {tr.worth.emptyTroubles}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3 font-medium">{tr.worth.colMaterialNcm}</th>
                    <th className="py-2.5 px-3 font-medium">{tr.common.supplier}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{tr.worth.colPosLateRate}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{tr.worth.colAirSea}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{tr.worth.colStorageDem}</th>
                    <th className="py-2.5 px-3 font-medium">{tr.worth.colSignals}</th>
                    <th className="py-2.5 px-3 font-medium">{tr.worth.colFutureFix}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredTroubles.map((mat) => (
                    <tr
                      key={mat.materialCode}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-3 align-top max-w-[240px]">
                        <div className="font-mono font-semibold text-cyan-700 dark:text-cyan-300">
                          {mat.materialCode}
                        </div>
                        <div className="text-slate-800 dark:text-slate-200 font-medium line-clamp-2">
                          {lang === 'en' && mat.descEn ? mat.descEn : mat.descPt}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          NCM {mat.ncm} · {tr.common.plant0003}: {mat.stockPlant0003}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top max-w-[160px]">
                        <div className="text-slate-800 dark:text-slate-200 truncate">
                          {mat.primarySupplier}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {fmt(tr.worth.spendPrefix, { val: formatCompactBrl(mat.totalSpendBrl, true) })}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top text-right font-mono tabular-nums">
                        <div
                          className={
                            mat.lateOrderCount > 0
                              ? 'font-semibold text-rose-600 dark:text-rose-400'
                              : 'text-slate-900 dark:text-white'
                          }
                        >
                          {fmt(tr.worth.lateCountRate, {
                            late: mat.lateOrderCount,
                            total: mat.orderCount,
                            rate: mat.delayedRatePct,
                          })}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {mat.maxDelayDays > 0
                            ? fmt(tr.worth.maxDelayDays, { days: mat.maxDelayDays })
                            : tr.worth.onTimeLabel}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top text-right font-mono tabular-nums">
                        <div className="text-slate-900 dark:text-white">
                          {fmt(tr.worth.airSeaCount, {
                            air: mat.airShipmentCount,
                            sea: mat.seaShipmentCount,
                          })}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {mat.exwOrderCount > 0
                            ? fmt(tr.worth.exwCount, { count: mat.exwOrderCount })
                            : 'FCA/FOB'}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top text-right font-mono tabular-nums">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {formatCurrency(mat.totalStorageAndDemurrageBrl, 'BRL')}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {fmt(tr.worth.frtStoFob, { pct: mat.avgCostOverFobPct })}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top max-w-[220px]">
                        <StatusBadge
                          label={tr.worth.severityRisk[mat.severity]}
                          tone={SEVERITY_TONE[mat.severity]}
                        />
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {mat.troubleSignals.length === 0 ? (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {tr.worth.noChronicAlerts}
                            </span>
                          ) : (
                            mat.troubleSignals.map((sig) => (
                              <span
                                key={sig}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px]"
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                                {translateTroubleSignal(sig, lang)}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top max-w-[270px]">
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                          {translateFutureFix(mat.recommendedFutureFix, lang)}
                        </p>
                        {mat.linkedProcesses.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {mat.linkedProcesses.slice(0, 3).map((ref) => (
                              <button
                                key={ref}
                                type="button"
                                onClick={() => {
                                  const match = analysis.rows.find((r) => r.ref === ref);
                                  if (match) {
                                    setSelectedRef(ref);
                                  } else {
                                    onSelectProcess(ref);
                                  }
                                }}
                                className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10"
                              >
                                {ref}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Detailed Audit Slide-Over Drawer */}
      <WorthinessDetailDrawer
        row={selectedRow}
        onClose={() => setSelectedRef(null)}
        onOpenShipmentWorkbench={onSelectProcess}
      />
    </div>
  );
};

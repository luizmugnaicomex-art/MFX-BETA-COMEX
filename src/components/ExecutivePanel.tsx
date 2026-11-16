import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import {
  AlertTriangle,
  Package,
  Ship,
  ShieldCheck,
  Clock,
  Container,
  Gauge,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import type { FupItemRow, ShipmentProcessRow } from '../types/comex';
import {
  computeDirectorChartMetrics,
  computeExecutiveKpis,
  isDrawbackExpectedNcm,
} from '../utils/comexEngine';
import { formatCurrency, formatDateBr, formatNumber } from '../utils/sapParser';
import {
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
  formatCompactQty,
} from '../utils/chartFormatters';
import { StatusBadge, getDeliveryStatusTone } from './StatusBadge';
import { useI18n } from '../i18n/I18nContext';
import {
  translateChannel,
  translateDeliveryStatus,
  translatePipelineStage,
} from '../i18n/helpers';

interface ExecutivePanelProps {
  items: FupItemRow[];
  processes: ShipmentProcessRow[];
  activeNcmFilter?: string;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  onSelectProcess: (ref: string) => void;
  onFilterByNcm: (ncm: string) => void;
}

export const ExecutivePanel: React.FC<ExecutivePanelProps> = ({
  items,
  processes,
  activeNcmFilter = '',
  hasActiveFilters = false,
  onResetFilters,
  onSelectProcess,
  onFilterByNcm,
}) => {
  const { lang, tr, fmt } = useI18n();
  const kpis = useMemo(() => computeExecutiveKpis(items, processes), [items, processes]);
  const directorMetrics = useMemo(() => computeDirectorChartMetrics(processes), [processes]);

  const channelData = useMemo(
    () =>
      directorMetrics.channelBreakdown.map((ch) => ({
        ...ch,
        label: translateChannel(ch.key, lang),
      })),
    [directorMetrics.channelBreakdown, lang]
  );

  const modalChartData = useMemo(
    () =>
      directorMetrics.containerAndModal.modalChartData.map((entry) => ({
        ...entry,
        label:
          entry.label === 'Aéreo'
            ? tr.enums.modal.AEREO
            : entry.label === 'Rodoviário'
              ? tr.enums.modal.RODOVIARIO
              : entry.label,
      })),
    [directorMetrics.containerAndModal.modalChartData, tr]
  );

  const pipelineData = useMemo(
    () =>
      directorMetrics.processPipeline.map((st) => ({
        ...st,
        label: translatePipelineStage(st.stage, lang),
      })),
    [directorMetrics.processPipeline, lang]
  );

  const openPoItems = useMemo(
    () =>
      items
        .filter((i) => i.LOEKZ !== 'L' && i.STATUS_PRAZO_ENTREGA !== 'ITEM EXCLUIDO' && i.QUANTIDADE_PENDENTE > 0)
        .sort((a, b) => b.DIAS_ATRASO_ENTREGA - a.DIAS_ATRASO_ENTREGA),
    [items]
  );

  const openPoChartData = useMemo(
    () =>
      openPoItems.slice(0, 8).map((i) => ({
        name: `${i.PEDIDO}`,
        supplier: i.NOME_FORNECEDOR.split(' ')[0],
        pending: i.QUANTIDADE_PENDENTE,
        delayed: i.DIAS_ATRASO_ENTREGA > 0,
      })),
    [openPoItems]
  );

  const drawbackTotal = kpis.drawbackFobBrl + kpis.fullTaxFobBrl;
  const drawbackPct = drawbackTotal > 0 ? Math.round((kpis.drawbackFobBrl / drawbackTotal) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr.executive.activePosTitle}</span>
            <Package className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {kpis.activePoCount} POs
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {fmt(tr.executive.openLines, { count: kpis.openItemCount })}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              {tr.executive.openQty}{' '}
              <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {formatNumber(kpis.totalOpenQty, 0)}
              </strong>
            </span>
            <span className="font-mono tabular-nums text-cyan-700 dark:text-cyan-300 font-medium">
              {Object.entries(kpis.openValueByCurrency)
                .map(([curr, val]) => formatCurrency(val, curr))
                .join(' · ') || 'USD 0,00'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr.executive.deliveryHealthTitle}</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {kpis.onTimeRate}%
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{tr.executive.onTimeRate}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
              {fmt(tr.executive.onTimeDone, { onTime: kpis.onTimeCount, done: kpis.completedCount })}
            </span>
            <span className="text-rose-600 dark:text-rose-400 font-mono tabular-nums">
              {fmt(tr.executive.delayedAvg, { count: kpis.delayedCount, days: kpis.avgDelayDays })}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr.executive.activeProcessesTitle}</span>
            <Ship className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {kpis.processCounts.total}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{tr.executive.mfxRefs}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono tabular-nums">
            <span className="text-cyan-700 dark:text-cyan-300">
              {fmt(tr.executive.transitCount, { count: kpis.processCounts.inTransit })}
            </span>
            <span className="text-amber-700 dark:text-amber-300">
              {fmt(tr.executive.clearanceCount, {
                count: kpis.processCounts.awaitingClearance + kpis.processCounts.stoppedDrawback,
              })}
            </span>
            <span className="text-emerald-700 dark:text-emerald-300">
              {fmt(tr.executive.deliveredCount, { count: kpis.processCounts.delivered })}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr.executive.drawbackTitle}</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {drawbackPct}%
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{tr.executive.underAc}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              DBK: {formatCurrency(kpis.drawbackFobBrl, 'BRL')}
            </span>
            <span className="text-amber-700 dark:text-amber-300 font-mono tabular-nums">
              {fmt(tr.executive.taxesLabel, { val: formatCurrency(kpis.totalTaxesBrl, 'BRL') })}
            </span>
          </div>
        </div>
      </div>

      {/* Director Control & Performance Overview (2x2 KPI Charts) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">
              {tr.executive.directorTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {fmt(tr.executive.directorSubtitle, {
                total: directorMetrics.totalProcesses,
                di: directorMetrics.registeredDiCount,
              })}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span>
              {tr.executive.totalTeus}{' '}
              <strong className="text-slate-900 dark:text-white">
                {directorMetrics.containerAndModal.totalTeus}
              </strong>
            </span>
            <span>·</span>
            <span>
              {tr.executive.avgLeadTime}{' '}
              <strong className="text-cyan-700 dark:text-cyan-300">
                {directorMetrics.timingMetrics.avgLeadTimeDays}{tr.common.daysSuffix}
              </strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chart 1: Customs Parametrization Channels */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {tr.executive.channelsTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {tr.executive.channelsSubtitle}
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {fmt(tr.executive.withDi, {
                  di: directorMetrics.registeredDiCount,
                  total: directorMetrics.totalProcesses,
                })}
              </span>
            </div>

            {directorMetrics.totalProcesses === 0 ? (
              <div className="flex-1 min-h-[200px] flex items-center justify-center text-xs text-slate-400">
                {tr.executive.noProcessesFilter}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center flex-1">
                <div className="sm:col-span-5 h-[195px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={channelData.filter((c) => c.count > 0)}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={44}
                        outerRadius={74}
                        paddingAngle={3}
                        stroke="none"
                        isAnimationActive={false}
                        labelLine={false}
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                          if (!value || midAngle === undefined) return null;
                          const rad = Math.PI / 180;
                          const r = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.5;
                          const x = Number(cx) + r * Math.cos(-midAngle * rad);
                          const y = Number(cy) + r * Math.sin(-midAngle * rad);
                          return (
                            <text
                              x={x}
                              y={y}
                              fill="#ffffff"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={11}
                              fontWeight={700}
                            >
                              {value}
                            </text>
                          );
                        }}
                      >
                        {channelData
                          .filter((c) => c.count > 0)
                          .map((entry) => (
                            <Cell key={entry.key} fill={entry.color} />
                          ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [
                          fmt(tr.executive.procUnit, { count: Number(value ?? 0) }),
                          String(name ?? ''),
                        ]}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white leading-none">
                      {directorMetrics.totalProcesses}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
                      {tr.executive.processesLabel}
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-7 space-y-2">
                  {channelData.map((ch) => (
                    <div
                      key={ch.key}
                      className="flex items-center justify-between gap-2 text-xs py-1 border-b border-slate-100 dark:border-slate-800/70 last:border-b-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: ch.color }}
                        />
                        <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                          {ch.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-mono tabular-nums shrink-0">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {ch.count}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 w-10 text-right">
                          {ch.pct}%
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 w-24 text-right">
                          {formatCurrency(ch.fobBrl, 'BRL')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chart 2: Container Volume & Modal Mix */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Container className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  {tr.executive.containerTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {tr.executive.containerSubtitle}
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-amber-700 dark:text-amber-300">
                {fmt(tr.executive.activeCntrWatch, {
                  count: directorMetrics.containerAndModal.demurrageWatchCount,
                })}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {tr.executive.cntr20}
                </div>
                <div className="text-base font-bold font-mono tabular-nums text-cyan-700 dark:text-cyan-300">
                  {directorMetrics.containerAndModal.total20}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {tr.executive.cntr40}
                </div>
                <div className="text-base font-bold font-mono tabular-nums text-indigo-700 dark:text-indigo-300">
                  {directorMetrics.containerAndModal.total40}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {tr.executive.totalTeusCard}
                </div>
                <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {directorMetrics.containerAndModal.totalTeus}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {tr.executive.airSeaCard}
                </div>
                <div className="text-base font-bold font-mono tabular-nums text-amber-700 dark:text-amber-300">
                  {directorMetrics.containerAndModal.airCount}/{directorMetrics.containerAndModal.seaCount}
                </div>
              </div>
            </div>

            {directorMetrics.totalProcesses === 0 ? (
              <div className="flex-1 min-h-[140px] flex items-center justify-center text-xs text-slate-400">
                {tr.executive.noModalData}
              </div>
            ) : (
              <div className="h-[155px] text-slate-700 dark:text-slate-200">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={modalChartData}
                    margin={{ top: 20, right: 12, left: -16, bottom: 2 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        Number(value ?? 0),
                        name === 'count' ? tr.executive.unitsShipments : 'TEUs',
                      ]}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    />
                    <Bar dataKey="count" name="count" radius={[5, 5, 0, 0]} maxBarSize={48}>
                      {modalChartData.map((entry) => (
                        <Cell key={entry.label} fill={entry.color} />
                      ))}
                      <LabelList
                        dataKey="count"
                        position="top"
                        fill="currentColor"
                        fontSize={11}
                        fontWeight={600}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Chart 3: Process Pipeline by Operational Stage */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  {tr.executive.pipelineTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {tr.executive.pipelineSubtitle}
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {fmt(tr.executive.totalCount, { count: directorMetrics.totalProcesses })}
              </span>
            </div>

            {directorMetrics.totalProcesses === 0 ? (
              <div className="flex-1 min-h-[200px] flex items-center justify-center text-xs text-slate-400">
                {tr.executive.noActiveProcesses}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center flex-1">
                <div className="sm:col-span-6 h-[200px] text-slate-700 dark:text-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={pipelineData}
                      margin={{ top: 4, right: 26, left: 2, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" horizontal={false} />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={118}
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value) => [
                          fmt(tr.executive.processesUnit, { count: Number(value ?? 0) }),
                          tr.executive.stageCount,
                        ]}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      />
                      <Bar dataKey="count" radius={[0, 5, 5, 0]} barSize={18}>
                        {pipelineData.map((entry) => (
                          <Cell key={entry.stage} fill={entry.color} />
                        ))}
                        <LabelList
                          dataKey="count"
                          position="right"
                          fill="currentColor"
                          fontSize={11}
                          fontWeight={600}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="sm:col-span-6 space-y-2">
                  {pipelineData.map((st) => (
                    <div
                      key={st.stage}
                      className="flex items-center justify-between gap-2 text-xs py-1 border-b border-slate-100 dark:border-slate-800/70 last:border-b-0"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-sm shrink-0"
                          style={{ backgroundColor: st.color }}
                        />
                        <span className="text-slate-600 dark:text-slate-300 truncate">
                          {st.label}
                        </span>
                      </div>
                      <div className="font-mono tabular-nums text-right shrink-0">
                        <span className="font-semibold text-slate-900 dark:text-white mr-2">
                          {st.count}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatCurrency(st.fobBrl, 'BRL')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chart 4: Timing & Lead-Time Control */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  {tr.executive.timingTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {tr.executive.timingSubtitle}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {tr.executive.avgTransit}
                </div>
                <div className="text-base font-bold font-mono tabular-nums text-cyan-700 dark:text-cyan-300">
                  {directorMetrics.timingMetrics.avgTransitDays}{tr.common.daysSuffix}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {tr.executive.avgClearance}
                </div>
                <div className="text-base font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                  {directorMetrics.timingMetrics.avgClearanceDays}{tr.common.daysSuffix}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {tr.executive.avgStorage}
                </div>
                <div className="text-base font-bold font-mono tabular-nums text-amber-700 dark:text-amber-300">
                  {directorMetrics.timingMetrics.avgStorageDays}{tr.common.daysSuffix}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {tr.executive.avgLeadTimeCard}
                </div>
                <div className="text-base font-bold font-mono tabular-nums text-indigo-700 dark:text-indigo-300">
                  {directorMetrics.timingMetrics.avgLeadTimeDays}{tr.common.daysSuffix}
                </div>
              </div>
            </div>

            {directorMetrics.timingMetrics.perProcess.length === 0 ? (
              <div className="flex-1 min-h-[140px] flex items-center justify-center text-xs text-slate-400">
                {tr.executive.noTimingTelemetry}
              </div>
            ) : (
              <div className="h-[155px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={directorMetrics.timingMetrics.perProcess}
                    margin={{ top: 20, right: 8, left: -16, bottom: 2 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                    <XAxis
                      dataKey="shortRef"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    />
                    <Bar dataKey="transitDays" name={tr.executive.transitSeries} fill="#06b6d4" radius={[3, 3, 0, 0]}>
                      <LabelList
                        dataKey="transitDays"
                        position="top"
                        fill="#06b6d4"
                        fontSize={9}
                        fontWeight={600}
                        formatter={(v) => (Number(v) > 0 ? `${v}${tr.common.daysSuffix}` : '')}
                      />
                    </Bar>
                    <Bar dataKey="clearanceDays" name={tr.executive.clearanceSeries} fill="#10b981" radius={[3, 3, 0, 0]}>
                      <LabelList
                        dataKey="clearanceDays"
                        position="top"
                        fill="#10b981"
                        fontSize={9}
                        fontWeight={600}
                        formatter={(v) => (Number(v) > 0 ? `${v}${tr.common.daysSuffix}` : '')}
                      />
                    </Bar>
                    <Bar dataKey="storageDays" name={tr.executive.storageSeries} fill="#f59e0b" radius={[3, 3, 0, 0]}>
                      <LabelList
                        dataKey="storageDays"
                        position="top"
                        fill="#f59e0b"
                        fontSize={9}
                        fontWeight={600}
                        formatter={(v) => (Number(v) > 0 ? `${v}${tr.common.daysSuffix}` : '')}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-cyan-500 inline-block" /> {tr.executive.transitLegend}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> {tr.executive.clearanceLegend}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-amber-500 inline-block" /> {tr.executive.storageLegend}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {directorMetrics.timingMetrics.perProcess.slice(0, 5).map((p) => (
                  <button
                    key={p.processRef}
                    type="button"
                    onClick={() => onSelectProcess(p.processRef)}
                    className="font-mono text-cyan-700 dark:text-cyan-400 hover:underline"
                    title={fmt(tr.executive.inspectRef, { ref: p.processRef })}
                  >
                    {p.shortRef}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split: Open Quantities Monitor + Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {tr.executive.openMonitorTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tr.executive.openMonitorSubtitle}
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {fmt(tr.executive.activeLines, { count: openPoItems.length })}
            </span>
          </div>

          {openPoItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400 space-y-2">
              <div>{tr.executive.noPendingPo}</div>
              {hasActiveFilters && onResetFilters && (
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  {tr.executive.clearAllFilters}
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                    <th className="py-2.5 px-2 font-medium">{tr.executive.colPoRef}</th>
                    <th className="py-2.5 px-2 font-medium">{tr.executive.colMaterialDesc}</th>
                    <th className="py-2.5 px-2 font-medium">{tr.executive.colNcm}</th>
                    <th className="py-2.5 px-2 font-medium">{tr.executive.colPepProject}</th>
                    <th className="py-2.5 px-2 font-medium">{tr.executive.colSupplier}</th>
                    <th className="py-2.5 px-2 font-medium text-right">{tr.executive.colOpenQty}</th>
                    <th className="py-2.5 px-2 font-medium">{tr.executive.colEindtDelay}</th>
                    <th className="py-2.5 px-2 font-medium">{tr.executive.colStatus}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {openPoItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {item.PEDIDO}
                        </div>
                        {item.ULTIMO_PROCESSO_IMPORTACAO ? (
                          <button
                            type="button"
                            onClick={() => onSelectProcess(item.ULTIMO_PROCESSO_IMPORTACAO)}
                            className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 hover:underline"
                          >
                            {item.ULTIMO_PROCESSO_IMPORTACAO}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">{tr.common.noShipment}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 max-w-[140px]">
                        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {item.MATERIAL}
                        </div>
                        <div className="truncate font-medium text-slate-900 dark:text-slate-100" title={item.DESCRICAO_MATERIAL}>
                          {item.DESCRICAO_MATERIAL}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 font-mono whitespace-nowrap">
                        <span className="text-slate-700 dark:text-slate-300">{item.FUP_NCMS}</span>
                        {isDrawbackExpectedNcm(item.FUP_NCMS) && !item.FUP_ATO_CONCESSORIO && (
                          <span
                            title={tr.executive.drawbackMissingTooltip}
                            className="ml-1 inline-flex items-center text-amber-600 dark:text-amber-400"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 max-w-[105px] truncate text-slate-700 dark:text-slate-300" title={item.DESCRICAO_ELEMENTO_PEP}>
                        {item.DESCRICAO_ELEMENTO_PEP || '-'}
                      </td>
                      <td className="py-2.5 px-2 max-w-[105px] truncate text-slate-700 dark:text-slate-300" title={item.NOME_FORNECEDOR}>
                        {item.NOME_FORNECEDOR}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums whitespace-nowrap font-semibold text-slate-900 dark:text-white">
                        {formatNumber(item.QUANTIDADE_PENDENTE, 0)} {item.UNIDADE}
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap font-mono tabular-nums">
                        <div className="text-slate-700 dark:text-slate-300">
                          {formatDateBr(item.DATA_ENTREGA_PREVISTA)}
                        </div>
                        {item.DIAS_ATRASO_ENTREGA > 0 && (
                          <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                            {fmt(tr.executive.delayDays, { days: item.DIAS_ATRASO_ENTREGA })}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <StatusBadge
                          label={translateDeliveryStatus(item.STATUS_PRAZO_ENTREGA, lang)}
                          tone={getDeliveryStatusTone(item.STATUS_PRAZO_ENTREGA)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Open Qty by PO Chart */}
        <div className="xl:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {tr.executive.pendingVolTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tr.executive.pendingVolSubtitle}
            </p>
          </div>
          <div className="flex-1 min-h-[240px] text-slate-700 dark:text-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={openPoChartData} margin={{ top: 20, right: 6, left: -18, bottom: 18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                />
                <Bar dataKey="pending" name={tr.executive.colOpenQty} radius={[4, 4, 0, 0]}>
                  {openPoChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.delayed ? '#f43f5e' : '#06b6d4'} />
                  ))}
                  <LabelList
                    dataKey="pending"
                    position="top"
                    fill="currentColor"
                    fontSize={10}
                    fontWeight={600}
                    formatter={(v) => formatCompactQty(Number(v) || 0)}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Split: NCM & Drawback AC Control + Project PEP Progress Tracker */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* NCM & Ato Concessorio Control */}
        <div className="xl:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {tr.executive.ncmControlTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tr.executive.ncmControlSubtitle}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2 px-3 font-medium">{tr.executive.colNcm}</th>
                  <th className="py-2 px-3 font-medium text-right">{tr.executive.colItems}</th>
                  <th className="py-2 px-3 font-medium text-right">{tr.executive.colOpenQty}</th>
                  <th className="py-2 px-3 font-medium text-right">{tr.executive.colOrderValue}</th>
                  <th className="py-2 px-3 font-medium">{tr.executive.colAcAlert}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {kpis.ncmSummary.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-3 text-center text-xs text-slate-500 dark:text-slate-400">
                      {tr.executive.noNcmRecords}
                    </td>
                  </tr>
                ) : (
                  kpis.ncmSummary.map((row) => {
                    const filterToken = row.ncm === 'SEM NCM' ? '__MISSING__' : row.ncm;
                    const isActiveNcm =
                      activeNcmFilter === filterToken || activeNcmFilter === row.ncm;
                    return (
                      <tr
                        key={row.ncm}
                        onClick={() => onFilterByNcm(filterToken)}
                        className={`cursor-pointer transition-colors ${
                          isActiveNcm
                            ? 'bg-cyan-500/12 dark:bg-cyan-500/15'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2">
                            <span>{row.ncm === 'SEM NCM' ? tr.app.noNcm : row.ncm}</span>
                            {isActiveNcm && (
                              <span className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded bg-cyan-600 text-white">
                                {tr.executive.filteredClickClear}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {row.itemCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                          {formatNumber(row.openQty, 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                          {formatCurrency(row.totalValueUsdOrOrig, row.currency)}
                        </td>
                        <td className="py-2.5 px-3">
                          {row.acNumbers.length > 0 ? (
                            <span className="font-mono text-emerald-700 dark:text-emerald-300">
                              AC {row.acNumbers.join(', ')}
                            </span>
                          ) : row.missingAcAlert ? (
                            <StatusBadge label={tr.executive.missingAcBadge} tone="amber" />
                          ) : (
                            <span className="text-slate-400">{tr.executive.fullTaxLabel}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Project / Elemento PEP Progress Tracker */}
        <div className="xl:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {tr.executive.pepTrackerTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tr.executive.pepTrackerSubtitle}
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
              <span className="flex items-center gap-1 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block shrink-0" /> {tr.executive.legendPlant}
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block shrink-0" /> {tr.executive.legendInTransit}
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-700 inline-block shrink-0" /> {tr.executive.legendOpenPo}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {kpis.pepProgress.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                {tr.executive.noPepProjects}
              </div>
            ) : (
              kpis.pepProgress.map((pep, idx) => (
                <div key={`${pep.pepCode}::${pep.pepDescription}::${idx}`} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate pr-3">
                      {pep.pepDescription}{' '}
                      <span className="font-mono text-[11px] text-slate-400">({pep.pepCode})</span>
                    </div>
                    <div className="font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {fmt(tr.executive.pctRec, {
                        pct: pep.pctReceived,
                        val: formatCurrency(pep.totalValueBrl, 'BRL'),
                      })}
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                    <div
                      style={{ width: `${pep.pctReceived}%` }}
                      className="bg-emerald-500 h-full transition-all"
                      title={fmt(tr.executive.receivedTooltip, { qty: formatNumber(pep.receivedQty, 0) })}
                    />
                    <div
                      style={{ width: `${pep.pctInTransit}%` }}
                      className="bg-cyan-500 h-full transition-all"
                      title={fmt(tr.executive.inTransitTooltip, { qty: formatNumber(pep.inTransitQty, 0) })}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    <span>{fmt(tr.executive.orderedQty, { qty: formatNumber(pep.totalOrdered, 0) })}</span>
                    <span>
                      {fmt(tr.executive.pepProgressDetail, {
                        rec: formatNumber(pep.receivedQty, 0),
                        transit: formatNumber(pep.inTransitQty, 0),
                        pending: formatNumber(pep.pendingShipmentQty, 0),
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

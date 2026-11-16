import React, { useMemo, useState } from 'react';
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
  Legend,
} from 'recharts';
import {
  BarChart3,
  Clock,
  Container,
  DollarSign,
  FileCheck2,
  Gauge,
  Landmark,
  Layers,
  Receipt,
  ShieldAlert,
  Ship,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';
import type { FupItemRow, ShipmentProcessRow } from '../types/comex';
import { buildComexChartsAnalytics } from '../utils/comexEngine';
import { formatCurrency } from '../utils/sapParser';
import {
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
  formatAxisBrl,
  formatCompactBrl,
} from '../utils/chartFormatters';
import { useI18n } from '../i18n/I18nContext';
import { translateChannel, translatePipelineStage } from '../i18n/helpers';

interface ComexChartsPanelProps {
  items: FupItemRow[];
  processes: ShipmentProcessRow[];
  onSelectProcess: (ref: string) => void;
}

type ChartCategory = 'ALL' | 'VOLUME_CUSTOMS' | 'COSTS_TAXES' | 'TIMINGS_DELAYS' | 'TEAM_PROJECTS';

export const ComexChartsPanel: React.FC<ComexChartsPanelProps> = ({
  items,
  processes,
  onSelectProcess,
}) => {
  const { lang, tr, fmt } = useI18n();
  const [category, setCategory] = useState<ChartCategory>('ALL');

  const handleBarClick = (data: unknown) => {
    const d = data as { processRef?: string; payload?: { processRef?: string } } | null;
    const ref = d?.processRef || d?.payload?.processRef;
    if (ref) onSelectProcess(ref);
  };

  const analytics = useMemo(
    () => buildComexChartsAnalytics(items, processes),
    [items, processes]
  );

  const stageChartData = useMemo(
    () =>
      analytics.shipmentsByStage.map((s) => ({
        ...s,
        label: translatePipelineStage(s.stage, lang),
        barLabel:
          s.count > 0 && s.fobBrl > 0
            ? `${s.count} (${formatCompactBrl(s.fobBrl)})`
            : `${s.count}`,
      })),
    [analytics.shipmentsByStage, lang]
  );

  const channelChartData = useMemo(
    () =>
      analytics.customsChannels.map((c) => ({
        ...c,
        label: translateChannel(c.key, lang),
      })),
    [analytics.customsChannels, lang]
  );

  const containerMixData = useMemo(
    () =>
      analytics.containerMix.map((c) => ({
        ...c,
        label: tr.comexCharts.c3Labels[c.key],
      })),
    [analytics.containerMix, tr]
  );

  const delayStatusData = useMemo(
    () =>
      analytics.delaysByStatus.map((d) => ({
        ...d,
        label: tr.comexCharts.c6StatusLabels[d.statusKey],
      })),
    [analytics.delaysByStatus, tr]
  );

  const nfStatusData = useMemo(
    () =>
      analytics.nfStatusSummary.map((n) => ({
        ...n,
        label: tr.comexCharts.c8NfStatus[n.statusKey],
      })),
    [analytics.nfStatusSummary, tr]
  );

  const finStatusData = useMemo(
    () =>
      analytics.invoicesByFinancialStatus.map((f) => ({
        ...f,
        label: tr.comexCharts.c11FinStatus[f.statusKey],
      })),
    [analytics.invoicesByFinancialStatus, tr]
  );

  const teamData = useMemo(
    () =>
      analytics.teamResultsChart.slice(0, 8).map((m) => ({
        ...m,
        displayLabel: `${m.memberName} (${
          m.roleKey === 'ANALYST'
            ? tr.comexCharts.c12RoleAnalyst
            : tr.comexCharts.c12RoleBuyer
        })`,
      })),
    [analytics.teamResultsChart, tr]
  );

  const showVolumeCustoms = category === 'ALL' || category === 'VOLUME_CUSTOMS';
  const showCostsTaxes = category === 'ALL' || category === 'COSTS_TAXES';
  const showTimingsDelays = category === 'ALL' || category === 'TIMINGS_DELAYS';
  const showTeamProjects = category === 'ALL' || category === 'TEAM_PROJECTS';

  const hasAnyData = analytics.totals.totalItemLines > 0 || analytics.totals.totalShipments > 0;

  return (
    <div className="space-y-4">
      {/* Executive Header & Category Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
              {tr.comexCharts.headerEyebrow}
            </div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
              <BarChart3 className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span>{tr.comexCharts.headerTitle}</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {fmt(tr.comexCharts.headerSubtitle, {
                shipments: analytics.totals.totalShipments,
                pos: analytics.totals.totalPoCount,
                lines: analytics.totals.totalItemLines,
              })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: tr.comexCharts.catAll },
                { id: 'VOLUME_CUSTOMS', label: tr.comexCharts.catVolumeCustoms },
                { id: 'COSTS_TAXES', label: tr.comexCharts.catCostsTaxes },
                { id: 'TIMINGS_DELAYS', label: tr.comexCharts.catTimingsDelays },
                { id: 'TEAM_PROJECTS', label: tr.comexCharts.catTeamProjects },
              ] as Array<{ id: ChartCategory; label: string }>
            ).map((btn) => {
              const active = category === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setCategory(btn.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Inline Department Summary Telemetry Strip (Zero Pill Discipline: '·' separators) */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-white">
            {fmt(tr.comexCharts.statShipments, { count: analytics.totals.totalShipments })}
          </span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span>
            {fmt(tr.comexCharts.statContainers, {
              cntr: analytics.totals.totalContainers,
              teus: analytics.totals.totalTeus,
            })}
          </span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span className="text-cyan-700 dark:text-cyan-300">
            {fmt(tr.comexCharts.statFreight, {
              val: formatCurrency(analytics.totals.totalFreightBrl, 'BRL'),
            })}
          </span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span className="text-indigo-700 dark:text-indigo-300">
            {fmt(tr.comexCharts.statTaxes, {
              val: formatCurrency(analytics.totals.totalTaxesBrl, 'BRL'),
            })}
          </span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span className="text-rose-600 dark:text-rose-400">
            {fmt(tr.comexCharts.statDelays, {
              days: analytics.totals.totalDelayDays,
              pos: analytics.totals.delayedPoCount,
            })}
          </span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span className="text-emerald-700 dark:text-emerald-300">
            {fmt(tr.comexCharts.statInvoices, {
              val: formatCurrency(analytics.totals.totalInvoicesBrl, 'BRL'),
            })}
          </span>
        </div>
      </div>

      {!hasAnyData ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-500 dark:text-slate-400">
          {tr.comexCharts.emptyState}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* CHART 1: Quantity of Shipments by Operational Stage */}
          {showVolumeCustoms && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Ship className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>{tr.comexCharts.c1Title}</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tr.comexCharts.c1Subtitle}
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-cyan-700 dark:text-cyan-300 font-semibold whitespace-nowrap shrink-0">
                  {fmt(tr.comexCharts.c1RightMeta, {
                    count: analytics.totals.totalShipments,
                    val: formatCompactBrl(analytics.totals.totalShippedFobBrl),
                  })}
                </span>
              </div>

              <div className="h-[250px] text-slate-700 dark:text-slate-200">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stageChartData}
                    layout="vertical"
                    margin={{ top: 8, right: 95, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(148,163,184,0.18)"
                      horizontal={false}
                    />
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
                      width={130}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value, _name, item) => {
                        const fob = item?.payload?.fobBrl ?? 0;
                        return [
                          `${Number(value ?? 0)} (${formatCurrency(fob, 'BRL')})`,
                          tr.comexCharts.c1SeriesCount,
                        ];
                      }}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    />
                    <Bar
                      dataKey="count"
                      name={tr.comexCharts.c1SeriesCount}
                      radius={[0, 5, 5, 0]}
                      barSize={22}
                      isAnimationActive={false}
                    >
                      {stageChartData.map((entry) => (
                        <Cell key={entry.stage} fill={entry.color} />
                      ))}
                      <LabelList
                        dataKey="barLabel"
                        position="right"
                        fill="currentColor"
                        fontSize={11}
                        fontWeight={700}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* CHART 2: Channels of Customs (DI Parametrization) */}
          {showVolumeCustoms && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{tr.comexCharts.c2Title}</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tr.comexCharts.c2Subtitle}
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-300 font-semibold whitespace-nowrap shrink-0">
                  {fmt(tr.comexCharts.c2RightMeta, {
                    di: analytics.totals.registeredDiCount,
                    total: analytics.totals.totalShipments,
                  })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center h-[250px]">
                <div className="sm:col-span-5 h-[230px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={channelChartData.filter((c) => c.count > 0)}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={78}
                        paddingAngle={3}
                        stroke="none"
                        isAnimationActive={false}
                        labelLine={false}
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                          if (!value || midAngle === undefined) return null;
                          const rad = Math.PI / 180;
                          const r =
                            Number(innerRadius) +
                            (Number(outerRadius) - Number(innerRadius)) * 0.52;
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
                        {channelChartData
                          .filter((c) => c.count > 0)
                          .map((entry) => (
                            <Cell key={entry.key} fill={entry.color} />
                          ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [
                          `${Number(value ?? 0)}`,
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
                      {analytics.totals.totalShipments}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
                      {tr.comexCharts.c2SeriesCount}
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-7 h-[230px] text-slate-700 dark:text-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={channelChartData}
                      layout="vertical"
                      margin={{ top: 6, right: 78, left: 4, bottom: 6 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(148,163,184,0.18)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => formatAxisBrl(Number(v) || 0)}
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={105}
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value) => [
                          formatCurrency(Number(value ?? 0), 'BRL'),
                          tr.comexCharts.c1SeriesFob,
                        ]}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      />
                      <Bar
                        dataKey="fobBrl"
                        name={tr.comexCharts.c1SeriesFob}
                        radius={[0, 4, 4, 0]}
                        barSize={18}
                        isAnimationActive={false}
                      >
                        {channelChartData.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                        <LabelList
                          dataKey="fobBrl"
                          position="right"
                          fill="currentColor"
                          fontSize={10}
                          fontWeight={600}
                          formatter={(v: unknown) => formatCompactBrl(Number(v) || 0)}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* CHART 3: Quantity of Containers & Modal Mix */}
          {showVolumeCustoms && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Container className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>{tr.comexCharts.c3Title}</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tr.comexCharts.c3Subtitle}
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-indigo-700 dark:text-indigo-300 font-semibold whitespace-nowrap shrink-0">
                  {fmt(tr.comexCharts.c3RightMeta, {
                    c20: analytics.totals.total20Cntr,
                    c40: analytics.totals.total40Cntr,
                    teus: analytics.totals.totalTeus,
                  })}
                </span>
              </div>

              <div className="h-[250px] text-slate-700 dark:text-slate-200">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={containerMixData}
                    margin={{ top: 24, right: 16, left: -12, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                    <XAxis
                      dataKey="label"
                      interval={0}
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
                      formatter={(value) => [
                        Number(value ?? 0),
                        tr.comexCharts.c3SeriesUnits,
                      ]}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    />
                    <Bar
                      dataKey="count"
                      name={tr.comexCharts.c3SeriesUnits}
                      radius={[5, 5, 0, 0]}
                      maxBarSize={46}
                      isAnimationActive={false}
                    >
                      {containerMixData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                      <LabelList
                        dataKey="count"
                        position="top"
                        fill="currentColor"
                        fontSize={11}
                        fontWeight={700}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* CHART 4: Costs of Freight (BRL) */}
          {showCostsTaxes && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Truck className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>{tr.comexCharts.c4Title}</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tr.comexCharts.c4Subtitle}
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-cyan-700 dark:text-cyan-300 font-semibold whitespace-nowrap shrink-0">
                  {fmt(tr.comexCharts.c4RightMeta, {
                    val: formatCurrency(analytics.totals.totalFreightBrl, 'BRL'),
                    pct: analytics.totals.freightPctOfFob,
                  })}
                </span>
              </div>

              <div className="h-[250px] text-slate-700 dark:text-slate-200">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.freightByProcess}
                    margin={{ top: 24, right: 16, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                    <XAxis
                      dataKey="shortRef"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => formatAxisBrl(Number(v) || 0)}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        formatCurrency(Number(value ?? 0), 'BRL'),
                        String(name ?? ''),
                      ]}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="intlFreightBrl"
                      name={tr.comexCharts.c4SeriesIntl}
                      fill="#06b6d4"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={42}
                      cursor="pointer"
                      isAnimationActive={false}
                      onClick={handleBarClick}
                    >
                      <LabelList
                        dataKey="intlFreightBrl"
                        position="top"
                        fill="currentColor"
                        fontSize={10}
                        fontWeight={600}
                        formatter={(v: unknown) => formatCompactBrl(Number(v) || 0)}
                      />
                    </Bar>
                    {analytics.totals.totalNationalFreightBrl > 0 && (
                      <Bar
                        dataKey="natFreightBrl"
                        name={tr.comexCharts.c4SeriesNat}
                        fill="#6366f1"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={42}
                        isAnimationActive={false}
                      >
                        <LabelList
                          dataKey="natFreightBrl"
                          position="top"
                          fill="#6366f1"
                          fontSize={10}
                          fontWeight={600}
                          formatter={(v: unknown) =>
                            Number(v) > 0 ? formatCompactBrl(Number(v)) : ''
                          }
                        />
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* CHART 5: Customs & Import Taxes (Strict SAP Recorded BRL) */}
          {showCostsTaxes && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                    <span>{tr.comexCharts.c5Title}</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tr.comexCharts.c5Subtitle}
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-violet-700 dark:text-violet-300 font-semibold whitespace-nowrap shrink-0">
                  {fmt(tr.comexCharts.c5RightMeta, {
                    val: formatCurrency(analytics.totals.totalTaxesBrl, 'BRL'),
                  })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center h-[250px]">
                <div className="sm:col-span-6 h-[235px] text-slate-700 dark:text-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.taxByType}
                      layout="vertical"
                      margin={{ top: 4, right: 68, left: 2, bottom: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(148,163,184,0.18)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => formatAxisBrl(Number(v) || 0)}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="key"
                        width={68}
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value) => [
                          formatCurrency(Number(value ?? 0), 'BRL'),
                          tr.comexCharts.c5SeriesTax,
                        ]}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      />
                      <Bar
                        dataKey="valueBrl"
                        name={tr.comexCharts.c5SeriesTax}
                        radius={[0, 4, 4, 0]}
                        barSize={16}
                        isAnimationActive={false}
                      >
                        {analytics.taxByType.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                        <LabelList
                          dataKey="valueBrl"
                          position="right"
                          fill="currentColor"
                          fontSize={10}
                          fontWeight={600}
                          formatter={(v: unknown) => formatCompactBrl(Number(v) || 0)}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="sm:col-span-6 h-[235px] text-slate-700 dark:text-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.taxByProcess}
                      margin={{ top: 22, right: 10, left: -12, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                      <XAxis
                        dataKey="shortRef"
                        interval={0}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => formatAxisBrl(Number(v) || 0)}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value) => [
                          formatCurrency(Number(value ?? 0), 'BRL'),
                          tr.comexCharts.c5SeriesTax,
                        ]}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      />
                      <Bar
                        dataKey="totalTaxesBrl"
                        name={tr.comexCharts.c5SeriesTax}
                        fill="#8b5cf6"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={38}
                        cursor="pointer"
                        isAnimationActive={false}
                        onClick={handleBarClick}
                      >
                        <LabelList
                          dataKey="totalTaxesBrl"
                          position="top"
                          fill="currentColor"
                          fontSize={9}
                          fontWeight={600}
                          formatter={(v: unknown) => formatCompactBrl(Number(v) || 0)}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* CHART 6: Delays Totalized */}
          {showTimingsDelays && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>{tr.comexCharts.c6Title}</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {fmt(tr.comexCharts.c6Subtitle, {
                      days: analytics.totals.totalDelayDays,
                      rate: analytics.totals.onTimeRatePct,
                    })}
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-rose-600 dark:text-rose-400 font-semibold whitespace-nowrap shrink-0">
                  {fmt(tr.comexCharts.c6RightMeta, {
                    days: analytics.totals.totalDelayDays,
                    max: analytics.totals.maxDelayDays,
                  })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center h-[250px]">
                <div className="sm:col-span-5 h-[230px] text-slate-700 dark:text-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={delayStatusData}
                      margin={{ top: 22, right: 8, left: -18, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                      <XAxis
                        dataKey="label"
                        interval={0}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
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
                        formatter={(value) => [Number(value ?? 0), tr.common.items]}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      />
                      <Bar
                        dataKey="lineCount"
                        name={tr.common.items}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={38}
                        isAnimationActive={false}
                      >
                        {delayStatusData.map((entry) => (
                          <Cell key={entry.statusKey} fill={entry.color} />
                        ))}
                        <LabelList
                          dataKey="lineCount"
                          position="top"
                          fill="currentColor"
                          fontSize={11}
                          fontWeight={700}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="sm:col-span-7 h-[230px] text-slate-700 dark:text-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.delaysByPo}
                      layout="vertical"
                      margin={{ top: 6, right: 44, left: 6, bottom: 6 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(148,163,184,0.18)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="poNumber"
                        width={84}
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value, _name, item) => [
                          `${Number(value ?? 0)}${tr.common.daysSuffix} (${item?.payload?.supplierShort || '-'})`,
                          tr.comexCharts.c6SeriesDelayDays,
                        ]}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      />
                      <Bar
                        dataKey="delayDays"
                        name={tr.comexCharts.c6SeriesDelayDays}
                        radius={[0, 4, 4, 0]}
                        barSize={16}
                        isAnimationActive={false}
                      >
                        {analytics.delaysByPo.map((entry) => (
                          <Cell
                            key={entry.poNumber}
                            fill={entry.delayDays > 0 ? '#f43f5e' : '#10b981'}
                          />
                        ))}
                        <LabelList
                          dataKey="delayDays"
                          position="right"
                          fill="currentColor"
                          fontSize={10}
                          fontWeight={700}
                          formatter={(v: unknown) => `${Number(v) || 0}${tr.common.daysSuffix}`}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* CHART 7: Time of Customs Clearance (Days) */}
          {showTimingsDelays && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{tr.comexCharts.c7Title}</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tr.comexCharts.c7Subtitle}
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-300 font-semibold whitespace-nowrap shrink-0">
                  {fmt(tr.comexCharts.c7RightMeta, {
                    avg: analytics.totals.avgClearanceDays,
                    cleared: analytics.totals.clearedProcessCount,
                    total: analytics.totals.totalShipments,
                  })}
                </span>
              </div>

              <div className="h-[250px] text-slate-700 dark:text-slate-200">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.clearanceByProcess}
                    margin={{ top: 24, right: 16, left: -12, bottom: 8 }}
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
                      formatter={(value, name) => [
                        `${Number(value ?? 0)}${tr.common.daysSuffix}`,
                        String(name ?? ''),
                      ]}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="presenceToDiDays"
                      name={tr.comexCharts.c7SeriesPresToDi}
                      fill="#06b6d4"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                      isAnimationActive={false}
                    >
                      <LabelList
                        dataKey="presenceToDiDays"
                        position="top"
                        fill="#06b6d4"
                        fontSize={10}
                        fontWeight={600}
                        formatter={(v: unknown) => `${Number(v) || 0}${tr.common.daysSuffix}`}
                      />
                    </Bar>
                    <Bar
                      dataKey="totalClearanceDays"
                      name={tr.comexCharts.c7SeriesTotalClearance}
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                      cursor="pointer"
                      isAnimationActive={false}
                      onClick={handleBarClick}
                    >
                      {analytics.clearanceByProcess.map((entry) => (
                        <Cell key={entry.processRef} fill={entry.color} />
                      ))}
                      <LabelList
                        dataKey="totalClearanceDays"
                        position="top"
                        fill="currentColor"
                        fontSize={10}
                        fontWeight={700}
                        formatter={(v: unknown) => `${Number(v) || 0}${tr.common.daysSuffix}`}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* CHART 8: Time of NF Issue & Factory Turnaround */}
          {showTimingsDelays && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>{tr.comexCharts.c8Title}</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tr.comexCharts.c8Subtitle}
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-cyan-700 dark:text-cyan-300 font-semibold whitespace-nowrap shrink-0">
                  {fmt(tr.comexCharts.c8RightMeta, {
                    avg: analytics.totals.avgNfTurnaroundDays,
                    issued: analytics.totals.nfIssuedCount,
                  })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center h-[250px]">
                <div className="sm:col-span-7 h-[230px] text-slate-700 dark:text-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.nfByProcess}
                      margin={{ top: 22, right: 12, left: -16, bottom: 6 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                      <XAxis
                        dataKey="shortRef"
                        interval={0}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
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
                        formatter={(value, _name, item) => {
                          const stKey = item?.payload?.nfStatusKey as
                            | 'ISSUED'
                            | 'PENDING_NF'
                            | 'AWAITING_CLEARANCE';
                          const nfNum = item?.payload?.nfNumber || '-';
                          return [
                            `${Number(value ?? 0)}${tr.common.daysSuffix} (NF: ${nfNum})`,
                            stKey ? tr.comexCharts.c8NfStatus[stKey] : tr.comexCharts.c8SeriesTurnaround,
                          ];
                        }}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      />
                      <Bar
                        dataKey="turnaroundDays"
                        name={tr.comexCharts.c8SeriesTurnaround}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                        cursor="pointer"
                        isAnimationActive={false}
                        onClick={handleBarClick}
                      >
                        {analytics.nfByProcess.map((entry) => (
                          <Cell key={entry.processRef} fill={entry.color} />
                        ))}
                        <LabelList
                          dataKey="turnaroundDays"
                          position="top"
                          fill="currentColor"
                          fontSize={10}
                          fontWeight={700}
                          formatter={(v: unknown) => `${Number(v) || 0}${tr.common.daysSuffix}`}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="sm:col-span-5 h-[230px] text-slate-700 dark:text-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={nfStatusData}
                      layout="vertical"
                      margin={{ top: 6, right: 32, left: 4, bottom: 6 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(148,163,184,0.18)"
                        horizontal={false}
                      />
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
                        width={110}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value) => [
                          Number(value ?? 0),
                          tr.comexCharts.c2SeriesCount,
                        ]}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      />
                      <Bar
                        dataKey="count"
                        name={tr.comexCharts.c2SeriesCount}
                        radius={[0, 4, 4, 0]}
                        barSize={18}
                        isAnimationActive={false}
                      >
                        {nfStatusData.map((entry) => (
                          <Cell key={entry.statusKey} fill={entry.color} />
                        ))}
                        <LabelList
                          dataKey="count"
                          position="right"
                          fill="currentColor"
                          fontSize={11}
                          fontWeight={700}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* CHART 9: Time of Delivery (Transit ETD->ETA vs Total Lead Time) */}
          {showTimingsDelays && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>{tr.comexCharts.c9Title}</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tr.comexCharts.c9Subtitle}
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-indigo-700 dark:text-indigo-300 font-semibold whitespace-nowrap shrink-0">
                  {fmt(tr.comexCharts.c9RightMeta, {
                    tt: analytics.totals.avgTransitDays,
                    lead: analytics.totals.avgLeadTimeDays,
                  })}
                </span>
              </div>

              <div className="h-[250px] text-slate-700 dark:text-slate-200">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.deliveryByProcess}
                    margin={{ top: 24, right: 16, left: -12, bottom: 8 }}
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
                      formatter={(value, name) => [
                        `${Number(value ?? 0)}${tr.common.daysSuffix}`,
                        String(name ?? ''),
                      ]}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="transitDays"
                      name={tr.comexCharts.c9SeriesTransit}
                      fill="#06b6d4"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                      isAnimationActive={false}
                    >
                      <LabelList
                        dataKey="transitDays"
                        position="top"
                        fill="#06b6d4"
                        fontSize={9}
                        fontWeight={600}
                        formatter={(v: unknown) => `${Number(v) || 0}${tr.common.daysSuffix}`}
                      />
                    </Bar>
                    <Bar
                      dataKey="portAndClearanceDays"
                      name={tr.comexCharts.c9SeriesPortClearance}
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                      isAnimationActive={false}
                    >
                      <LabelList
                        dataKey="portAndClearanceDays"
                        position="top"
                        fill="#f59e0b"
                        fontSize={9}
                        fontWeight={600}
                        formatter={(v: unknown) => `${Number(v) || 0}${tr.common.daysSuffix}`}
                      />
                    </Bar>
                    <Bar
                      dataKey="totalLeadTimeDays"
                      name={tr.comexCharts.c9SeriesLeadTime}
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                      cursor="pointer"
                      isAnimationActive={false}
                      onClick={handleBarClick}
                    >
                      <LabelList
                        dataKey="totalLeadTimeDays"
                        position="top"
                        fill="currentColor"
                        fontSize={10}
                        fontWeight={700}
                        formatter={(v: unknown) => `${Number(v) || 0}${tr.common.daysSuffix}`}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* CHART 10: Time of Storage & Terminal Cost */}
          {showTimingsDelays && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Warehouse className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{tr.comexCharts.c10Title}</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tr.comexCharts.c10Subtitle}
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-amber-700 dark:text-amber-300 font-semibold whitespace-nowrap shrink-0">
                  {fmt(tr.comexCharts.c10RightMeta, {
                    avg: analytics.totals.avgStorageDays,
                    periods: analytics.totals.totalStoragePeriods,
                    val: formatCompactBrl(analytics.totals.totalStorageCostBrl),
                  })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center h-[250px]">
                <div className="sm:col-span-6 h-[235px] text-slate-700 dark:text-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.storageByProcess}
                      margin={{ top: 22, right: 10, left: -16, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                      <XAxis
                        dataKey="shortRef"
                        interval={0}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value, _name, item) => [
                          `${Number(value ?? 0)}${tr.common.daysSuffix} (${
                            item?.payload?.storagePeriods ?? 0
                          }${tr.common.periodsSuffix})`,
                          tr.comexCharts.c10SeriesDays,
                        ]}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      />
                      <Bar
                        dataKey="storageDays"
                        name={tr.comexCharts.c10SeriesDays}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={36}
                        cursor="pointer"
                        isAnimationActive={false}
                        onClick={handleBarClick}
                      >
                        {analytics.storageByProcess.map((entry) => (
                          <Cell key={entry.processRef} fill={entry.color} />
                        ))}
                        <LabelList
                          dataKey="storageDays"
                          position="top"
                          fill="currentColor"
                          fontSize={10}
                          fontWeight={700}
                          formatter={(v: unknown) => `${Number(v) || 0}${tr.common.daysSuffix}`}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="sm:col-span-6 h-[235px] text-slate-700 dark:text-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.storageByProcess}
                      margin={{ top: 22, right: 12, left: -12, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                      <XAxis
                        dataKey="shortRef"
                        interval={0}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => formatAxisBrl(Number(v) || 0)}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value) => [
                          formatCurrency(Number(value ?? 0), 'BRL'),
                          tr.comexCharts.c10SeriesCost,
                        ]}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      />
                      <Bar
                        dataKey="storageCostBrl"
                        name={tr.comexCharts.c10SeriesCost}
                        fill="#f59e0b"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={36}
                        isAnimationActive={false}
                      >
                        <LabelList
                          dataKey="storageCostBrl"
                          position="top"
                          fill="currentColor"
                          fontSize={9}
                          fontWeight={600}
                          formatter={(v: unknown) => formatCompactBrl(Number(v) || 0)}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* CHART 11: Invoices Values & MIRO / FI Financial Status */}
          {showCostsTaxes && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{tr.comexCharts.c11Title}</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tr.comexCharts.c11Subtitle}
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-300 font-semibold whitespace-nowrap shrink-0">
                  {fmt(tr.comexCharts.c11RightMeta, {
                    val: formatCurrency(analytics.totals.totalInvoicesBrl, 'BRL'),
                  })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center h-[250px]">
                <div className="sm:col-span-6 h-[235px] text-slate-700 dark:text-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.invoicesByProcess}
                      margin={{ top: 22, right: 12, left: -12, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                      <XAxis
                        dataKey="shortRef"
                        interval={0}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => formatAxisBrl(Number(v) || 0)}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          formatCurrency(Number(value ?? 0), 'BRL'),
                          String(name ?? ''),
                        ]}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      />
                      <Bar
                        dataKey="invoiceBrl"
                        name={tr.comexCharts.c11SeriesFob}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={36}
                        cursor="pointer"
                        isAnimationActive={false}
                        onClick={handleBarClick}
                      >
                        {analytics.invoicesByProcess.map((entry) => (
                          <Cell key={entry.processRef} fill={entry.color} />
                        ))}
                        <LabelList
                          dataKey="invoiceBrl"
                          position="top"
                          fill="currentColor"
                          fontSize={9}
                          fontWeight={600}
                          formatter={(v: unknown) => formatCompactBrl(Number(v) || 0)}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="sm:col-span-6 h-[235px] text-slate-700 dark:text-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={finStatusData}
                      layout="vertical"
                      margin={{ top: 6, right: 72, left: 4, bottom: 6 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(148,163,184,0.18)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => formatAxisBrl(Number(v) || 0)}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={108}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value) => [
                          formatCurrency(Number(value ?? 0), 'BRL'),
                          tr.comexCharts.c11SeriesFob,
                        ]}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      />
                      <Bar
                        dataKey="amountBrl"
                        name={tr.comexCharts.c11SeriesFob}
                        radius={[0, 4, 4, 0]}
                        barSize={18}
                        isAnimationActive={false}
                      >
                        {finStatusData.map((entry) => (
                          <Cell key={entry.statusKey} fill={entry.color} />
                        ))}
                        <LabelList
                          dataKey="amountBrl"
                          position="right"
                          fill="currentColor"
                          fontSize={10}
                          fontWeight={600}
                          formatter={(v: unknown) => formatCompactBrl(Number(v) || 0)}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* CHART 12: Relevant Team & PEP Project Results */}
          {showTeamProjects && (
            <div
              className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col ${
                category === 'TEAM_PROJECTS' ? 'xl:col-span-2' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>{tr.comexCharts.c12Title}</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tr.comexCharts.c12Subtitle}
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-300 font-semibold whitespace-nowrap shrink-0">
                  {fmt(tr.comexCharts.c12RightMeta, {
                    pct: analytics.totals.drawbackCoveragePct,
                    val: formatCompactBrl(analytics.totals.drawbackFobBrl),
                  })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center h-[250px]">
                <div className="sm:col-span-6 h-[235px] text-slate-700 dark:text-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={teamData}
                      layout="vertical"
                      margin={{ top: 6, right: 74, left: 4, bottom: 6 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(148,163,184,0.18)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => formatAxisBrl(Number(v) || 0)}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="memberName"
                        width={92}
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value, _name, item) => [
                          `${formatCurrency(Number(value ?? 0), 'BRL')} · ${
                            item?.payload?.onTimePct ?? 100
                          }% On-Time`,
                          tr.comexCharts.c12SeriesTeamFob,
                        ]}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      />
                      <Bar
                        dataKey="fobBrl"
                        name={tr.comexCharts.c12SeriesTeamFob}
                        fill="#06b6d4"
                        radius={[0, 4, 4, 0]}
                        barSize={18}
                        isAnimationActive={false}
                      >
                        <LabelList
                          dataKey="fobBrl"
                          position="right"
                          fill="currentColor"
                          fontSize={10}
                          fontWeight={600}
                          formatter={(v: unknown) => formatCompactBrl(Number(v) || 0)}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="sm:col-span-6 h-[235px] text-slate-700 dark:text-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.pepProjectsChart}
                      layout="vertical"
                      margin={{ top: 6, right: 74, left: 4, bottom: 6 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(148,163,184,0.18)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => formatAxisBrl(Number(v) || 0)}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="pepCode"
                        width={86}
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          formatCurrency(Number(value ?? 0), 'BRL'),
                          String(name ?? ''),
                        ]}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      />
                      <Bar
                        dataKey="totalFobBrl"
                        name={tr.comexCharts.c1SeriesFob}
                        radius={[0, 4, 4, 0]}
                        barSize={18}
                        isAnimationActive={false}
                      >
                        {analytics.pepProjectsChart.map((entry) => (
                          <Cell
                            key={entry.pepCode}
                            fill={entry.drawbackBrl > 0 ? '#10b981' : '#f59e0b'}
                          />
                        ))}
                        <LabelList
                          dataKey="totalFobBrl"
                          position="right"
                          fill="currentColor"
                          fontSize={10}
                          fontWeight={600}
                          formatter={(v: unknown) => formatCompactBrl(Number(v) || 0)}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  LabelList,
} from 'recharts';
import { Download, Eye, Search } from 'lucide-react';
import type {
  FupItemRow,
  KraljicOverride,
  KraljicQuadrant,
} from '../types/comex';
import { buildMaterialAnalytics } from '../utils/comexEngine';
import { formatCurrency, formatNumber } from '../utils/sapParser';
import { formatCompactBrl } from '../utils/chartFormatters';
import { exportKraljicWorkbook } from '../utils/exportReports';
import { KRALJIC_META, MaterialCheckDrawer } from './MaterialCheckDrawer';
import { StatusBadge } from './StatusBadge';
import { useI18n } from '../i18n/I18nContext';
import { fmt } from '../i18n/translations';
import { translateKraljicStrategy, translateRiskDriver } from '../i18n/helpers';

interface KraljicMatrixPanelProps {
  items: FupItemRow[];
  kraljicOverrides: Record<string, KraljicOverride>;
  onSaveKraljicOverride: (materialKey: string, override: KraljicOverride | null) => void;
  onSelectProcess: (ref: string) => void;
}

const QUADRANT_ORDER: KraljicQuadrant[] = [
  'STRATEGIC',
  'LEVERAGE',
  'BOTTLENECK',
  'NON_CRITICAL',
];

export const KraljicMatrixPanel: React.FC<KraljicMatrixPanelProps> = ({
  items,
  kraljicOverrides,
  onSaveKraljicOverride,
  onSelectProcess,
}) => {
  const { lang, tr } = useI18n();
  const [quadrantFilter, setQuadrantFilter] = useState<'ALL' | KraljicQuadrant>('ALL');
  const [localSearch, setLocalSearch] = useState('');
  const [selectedMaterialKey, setSelectedMaterialKey] = useState<string | null>(null);

  const analytics = useMemo(
    () => buildMaterialAnalytics(items, kraljicOverrides),
    [items, kraljicOverrides]
  );

  const selectedMaterial = useMemo(
    () =>
      selectedMaterialKey
        ? analytics.materials.find((m) => m.materialKey === selectedMaterialKey) || null
        : null,
    [analytics.materials, selectedMaterialKey]
  );

  const filteredMaterials = useMemo(() => {
    const q = localSearch.trim().toLowerCase();
    return analytics.materials.filter((m) => {
      if (quadrantFilter !== 'ALL' && m.kraljicQuadrant !== quadrantFilter) return false;
      if (q) {
        const hay = `${m.materialCode} ${m.descPt} ${m.ncm} ${m.suppliers.join(' ')} ${m.riskDrivers.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [analytics.materials, quadrantFilter, localSearch]);

  const scatterPoints = useMemo(() => {
    const includeSpend = filteredMaterials.length <= 14;
    return filteredMaterials.map((m) => ({
      materialKey: m.materialKey,
      materialCode: m.materialCode,
      descShort: m.descPt.slice(0, 34),
      supplyRisk: m.supplyRiskScore,
      profitImpact: m.profitImpactScore,
      spendBrl: Math.max(1000, Math.round(m.totalSpendBrl)),
      pointLabel: includeSpend
        ? `${m.materialCode} · ${formatCompactBrl(m.totalSpendBrl, true)}`
        : m.materialCode,
      quadrant: m.kraljicQuadrant,
      suppliers: m.suppliers.join(', ') || '-',
      poCount: m.poCount,
    }));
  }, [filteredMaterials]);

  return (
    <div className="space-y-6">
      {/* 4 Interactive Quadrant Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {QUADRANT_ORDER.map((qKey) => {
          const meta = KRALJIC_META[qKey];
          const qTr = tr.kraljic.quadrants[qKey];
          const stat = analytics.quadrantSummary[qKey];
          const isSelected = quadrantFilter === qKey;
          return (
            <button
              key={qKey}
              type="button"
              onClick={() => setQuadrantFilter((curr) => (curr === qKey ? 'ALL' : qKey))}
              className={`text-left rounded-xl p-4 border transition-colors ${
                isSelected
                  ? 'bg-cyan-500/10 border-cyan-500 dark:bg-cyan-500/15 dark:border-cyan-400'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <StatusBadge
                  label={
                    qTr.label.toLowerCase() === qTr.localLabel.toLowerCase()
                      ? qTr.label
                      : `${qTr.label} (${qTr.localLabel})`
                  }
                  tone={meta.tone}
                />
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {fmt(stat.count === 1 ? tr.kraljic.skuPlural : tr.kraljic.skusPlural, { count: stat.count })}
                </span>
              </div>
              <div className="mt-2.5 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(stat.spendBrl, 'BRL')}
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>{qTr.subtitle}</span>
                <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                  {stat.spendPct}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Interactive 2x2 Kraljic Portfolio Matrix Plot */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {tr.kraljic.chartTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tr.kraljic.chartSubtitle}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                aria-label={tr.kraljic.searchAria}
                placeholder={tr.kraljic.searchPlaceholder}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white w-44"
              />
            </div>

            <button
              type="button"
              onClick={() => exportKraljicWorkbook(filteredMaterials)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              {tr.kraljic.exportBtn}
            </button>
          </div>
        </div>

        {/* Quadrant Guide Labels */}
        <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2">
          <div className="flex items-center justify-between px-3 py-1 rounded bg-emerald-500/8 text-emerald-700 dark:text-emerald-300">
            <span>{tr.kraljic.guideTopLeft}</span>
            <span>{tr.kraljic.guideTopLeftDesc}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-1 rounded bg-rose-500/8 text-rose-700 dark:text-rose-300">
            <span>{tr.kraljic.guideTopRight}</span>
            <span>{tr.kraljic.guideTopRightDesc}</span>
          </div>
        </div>

        {scatterPoints.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
            {tr.kraljic.emptyChart}
          </div>
        ) : (
          <div className="h-72 text-slate-700 dark:text-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 24, right: 32, bottom: 20, left: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis
                  type="number"
                  dataKey="supplyRisk"
                  name={tr.kraljic.colRisk}
                  domain={[0, 105]}
                  ticks={[0, 25, 50, 75, 100]}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  label={{
                    value: tr.kraljic.xAxisLabel,
                    position: 'insideBottom',
                    offset: -10,
                    fontSize: 11,
                    fill: '#94a3b8',
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="profitImpact"
                  name={tr.kraljic.yAxisLabel}
                  domain={[0, 106]}
                  ticks={[0, 25, 50, 75, 100]}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  label={{
                    value: tr.kraljic.yAxisLabel,
                    angle: -90,
                    position: 'insideLeft',
                    fontSize: 11,
                    fill: '#94a3b8',
                  }}
                />
                <ZAxis type="number" dataKey="spendBrl" range={[90, 460]} name={tr.kraljic.colTotalSpend} />
                <ReferenceLine x={50} stroke="#64748b" strokeDasharray="5 5" />
                <ReferenceLine y={50} stroke="#64748b" strokeDasharray="5 5" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const pt = payload[0].payload as (typeof scatterPoints)[number];
                    return (
                      <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-slate-100 shadow-lg space-y-1 max-w-xs">
                        <div className="font-mono font-bold text-cyan-300">{pt.materialCode}</div>
                        <div className="font-medium">{pt.descShort}</div>
                        <div className="text-slate-300">
                          {tr.kraljic.tooltipQuadrant} <strong>{tr.kraljic.quadrants[pt.quadrant].label}</strong>
                        </div>
                        <div className="font-mono tabular-nums">
                          {fmt(tr.kraljic.tooltipSpend, { val: formatCurrency(pt.spendBrl, 'BRL'), pos: pt.poCount })}
                        </div>
                        <div className="font-mono tabular-nums text-slate-300">
                          {fmt(tr.kraljic.tooltipScores, { impact: pt.profitImpact, risk: pt.supplyRisk })}
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={scatterPoints}
                  cursor="pointer"
                  onClick={(point) => {
                    const key = (point as unknown as { materialKey?: string })?.materialKey;
                    if (key) setSelectedMaterialKey(key);
                  }}
                >
                  {scatterPoints.map((pt) => (
                    <Cell key={pt.materialKey} fill={KRALJIC_META[pt.quadrant].color} fillOpacity={0.85} />
                  ))}
                  <LabelList
                    dataKey="pointLabel"
                    content={(props) => {
                      const { x, y, value, index } = props;
                      if (x === undefined || y === undefined || !value) return null;
                      const pt = typeof index === 'number' ? scatterPoints[index] : undefined;
                      const isHighY = (pt?.profitImpact ?? 0) >= 84;
                      const isLowerCluster =
                        pt &&
                        scatterPoints.some(
                          (other, oIdx) =>
                            oIdx !== index &&
                            Math.abs(other.supplyRisk - pt.supplyRisk) <= 6 &&
                            other.profitImpact > pt.profitImpact &&
                            other.profitImpact - pt.profitImpact <= 16
                        );
                      const placeBelow = isHighY || Boolean(isLowerCluster);
                      const yOffset = placeBelow ? 17 : -12;
                      return (
                        <text
                          x={Number(x)}
                          y={Number(y) + yOffset}
                          textAnchor="middle"
                          fill="currentColor"
                          fontSize={9.5}
                          fontWeight={600}
                          className="pointer-events-none select-none font-mono"
                        >
                          {String(value)}
                        </text>
                      );
                    }}
                  />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-2">
          <div className="flex items-center justify-between px-3 py-1 rounded bg-slate-500/8 text-slate-600 dark:text-slate-300">
            <span>{tr.kraljic.guideBottomLeft}</span>
            <span>{tr.kraljic.guideBottomLeftDesc}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-1 rounded bg-amber-500/8 text-amber-700 dark:text-amber-300">
            <span>{tr.kraljic.guideBottomRight}</span>
            <span>{tr.kraljic.guideBottomRightDesc}</span>
          </div>
        </div>
      </div>

      {/* Actionable Kraljic Portfolio Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {fmt(tr.kraljic.tableTitle, { count: filteredMaterials.length })}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tr.kraljic.tableSubtitle}
            </p>
          </div>
          {quadrantFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setQuadrantFilter('ALL')}
              className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              {tr.kraljic.showAllQuadrants}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                <th className="py-2.5 px-3 font-medium">{tr.kraljic.colMaterial}</th>
                <th className="py-2.5 px-3 font-medium">{tr.kraljic.colQuadrant}</th>
                <th className="py-2.5 px-3 font-medium text-right">{tr.kraljic.colImpact}</th>
                <th className="py-2.5 px-3 font-medium text-right">{tr.kraljic.colRisk}</th>
                <th className="py-2.5 px-3 font-medium">{tr.kraljic.colRiskDrivers}</th>
                <th className="py-2.5 px-3 font-medium text-right">{tr.kraljic.colTotalSpend}</th>
                <th className="py-2.5 px-3 font-medium text-right">{tr.kraljic.colBoughtUsed}</th>
                <th className="py-2.5 px-3 font-medium">{tr.kraljic.colStrategy}</th>
                <th className="py-2.5 px-3 font-medium text-right">{tr.kraljic.colAction}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 px-3 text-center text-xs text-slate-500 dark:text-slate-400">
                    {tr.kraljic.emptyTable}
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((mat) => {
                  const meta = KRALJIC_META[mat.kraljicQuadrant];
                  return (
                    <tr
                      key={mat.materialKey}
                      onClick={() => setSelectedMaterialKey(mat.materialKey)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 max-w-[220px]">
                        <div className="font-mono font-semibold text-slate-900 dark:text-white">
                          {mat.materialCode}{' '}
                          <span className="font-normal text-[11px] text-slate-400">
                            · {mat.suppliers.length} {tr.kraljic.supShort}
                          </span>
                        </div>
                        <div className="text-slate-600 dark:text-slate-300 truncate" title={mat.descPt}>
                          {mat.descPt}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <StatusBadge label={tr.kraljic.quadrants[mat.kraljicQuadrant].label} tone={meta.tone} />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                        {mat.profitImpactScore}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        {mat.supplyRiskScore}
                      </td>
                      <td className="py-2.5 px-3 max-w-[220px] text-slate-600 dark:text-slate-300">
                        {mat.riskDrivers.map((d) => translateRiskDriver(d, lang)).join(' · ') || tr.kraljic.lowFriction}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(mat.totalSpendBrl, 'BRL')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatNumber(mat.totalOrderedQty, 0)} / {formatNumber(mat.effectiveUsageQty, 0)} {mat.unit}
                      </td>
                      <td className="py-2.5 px-3 max-w-[240px] text-slate-600 dark:text-slate-300">
                        {mat.overrideNote || translateKraljicStrategy(mat.kraljicQuadrant, lang)}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMaterialKey(mat.materialKey);
                          }}
                          aria-label={fmt(tr.kraljic.checkAria, { code: mat.materialCode })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Eye className="w-3 h-3" />
                          {tr.common.check}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MaterialCheckDrawer
        material={selectedMaterial}
        onClose={() => setSelectedMaterialKey(null)}
        onSaveKraljicOverride={onSaveKraljicOverride}
        onSelectProcess={onSelectProcess}
      />
    </div>
  );
};

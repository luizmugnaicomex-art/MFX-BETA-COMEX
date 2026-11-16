import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import {
  ArrowUpDown,
  DollarSign,
  Download,
  Eye,
  Layers,
  PackageCheck,
  Search,
  ShoppingCart,
} from 'lucide-react';
import type {
  AbcClass,
  FupItemRow,
  KraljicOverride,
  MaterialProcurementItem,
  PqrClass,
} from '../types/comex';
import { buildMaterialAnalytics } from '../utils/comexEngine';
import { formatCurrency, formatNumber } from '../utils/sapParser';
import {
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
  formatAxisBrl,
  formatCompactBrl,
} from '../utils/chartFormatters';
import { exportPqrWorkbook } from '../utils/exportReports';
import { MaterialCheckDrawer } from './MaterialCheckDrawer';
import { StatusBadge } from './StatusBadge';

type RankingMode = 'ALL' | 'MOST_BOUGHT' | 'MOST_USED' | 'MOST_EXPENSIVE';

interface PqrControlPanelProps {
  items: FupItemRow[];
  kraljicOverrides: Record<string, KraljicOverride>;
  onSaveKraljicOverride: (materialKey: string, override: KraljicOverride | null) => void;
  onSelectProcess: (ref: string) => void;
}

const PQR_TONE: Record<PqrClass, 'cyan' | 'amber' | 'slate'> = {
  P: 'cyan',
  Q: 'amber',
  R: 'slate',
};

const PQR_COLOR: Record<PqrClass, string> = {
  P: '#06b6d4',
  Q: '#f59e0b',
  R: '#64748b',
};

const ABC_TONE: Record<AbcClass, 'rose' | 'amber' | 'slate'> = {
  A: 'rose',
  B: 'amber',
  C: 'slate',
};

export const PqrControlPanel: React.FC<PqrControlPanelProps> = ({
  items,
  kraljicOverrides,
  onSaveKraljicOverride,
  onSelectProcess,
}) => {
  const [rankingMode, setRankingMode] = useState<RankingMode>('ALL');
  const [pqrFilter, setPqrFilter] = useState<'ALL' | PqrClass>('ALL');
  const [abcFilter, setAbcFilter] = useState<'ALL' | AbcClass>('ALL');
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

  const displayedMaterials = useMemo(() => {
    const q = localSearch.trim().toLowerCase();
    const filtered = analytics.materials.filter((m) => {
      if (pqrFilter !== 'ALL' && m.pqrClass !== pqrFilter) return false;
      if (abcFilter !== 'ALL' && m.abcClass !== abcFilter) return false;
      if (q) {
        const hay = `${m.materialCode} ${m.descPt} ${m.descEn} ${m.ncm} ${m.suppliers.join(' ')} ${m.poNumbers.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    if (rankingMode === 'MOST_BOUGHT') {
      sorted.sort(
        (a, b) =>
          b.poCount - a.poCount ||
          b.totalOrderedQty - a.totalOrderedQty ||
          b.totalSpendBrl - a.totalSpendBrl
      );
    } else if (rankingMode === 'MOST_USED') {
      sorted.sort(
        (a, b) =>
          b.effectiveUsageQty - a.effectiveUsageQty ||
          b.totalReceivedQty - a.totalReceivedQty ||
          b.totalStockPlant0003 - a.totalStockPlant0003
      );
    } else if (rankingMode === 'MOST_EXPENSIVE') {
      sorted.sort(
        (a, b) => b.totalSpendBrl - a.totalSpendBrl || b.maxUnitPriceBrl - a.maxUnitPriceBrl
      );
    } else {
      // ALL: sort by PQR class (P -> Q -> R), then Spend BRL desc
      const order: Record<PqrClass, number> = { P: 0, Q: 1, R: 2 };
      sorted.sort(
        (a, b) => order[a.pqrClass] - order[b.pqrClass] || b.totalSpendBrl - a.totalSpendBrl
      );
    }
    return sorted;
  }, [analytics.materials, pqrFilter, abcFilter, localSearch, rankingMode]);

  const paretoChartData = useMemo(
    () =>
      displayedMaterials.slice(0, 10).map((m) => ({
        materialKey: m.materialKey,
        code: m.materialCode !== '-' ? m.materialCode : m.descPt.slice(0, 10),
        descShort: m.descPt.slice(0, 28),
        spendBrl: Math.round(m.totalSpendBrl),
        orderedQty: m.totalOrderedQty,
        usedQty: m.effectiveUsageQty,
        pqrClass: m.pqrClass,
      })),
    [displayedMaterials]
  );

  const highlightCard = (
    title: string,
    icon: React.ReactNode,
    item: MaterialProcurementItem | null,
    primaryMetric: string,
    secondaryMetric: string
  ) => (
    <button
      type="button"
      disabled={!item}
      onClick={() => item && setSelectedMaterialKey(item.materialKey)}
      className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-cyan-500/60 transition-colors disabled:opacity-60 disabled:cursor-default"
    >
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{title}</span>
        {icon}
      </div>
      {item ? (
        <>
          <div className="mt-2 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white truncate">
            {primaryMetric}
          </div>
          <div className="mt-0.5 text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
            {item.descPt}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span className="truncate">{secondaryMetric}</span>
            <span className="text-cyan-600 dark:text-cyan-400 font-sans font-medium shrink-0">
              Check →
            </span>
          </div>
        </>
      ) : (
        <div className="mt-3 text-xs text-slate-400">No items in active filter</div>
      )}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Top 4 Executive PQR Discovery Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>PQR Material Portfolio</span>
            <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {analytics.totalSkus} SKUs
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              P:{analytics.pqrCounts.P.count} · Q:{analytics.pqrCounts.Q.count} · R:{analytics.pqrCounts.R.count}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs font-mono tabular-nums">
            <span className="text-slate-500 dark:text-slate-400">
              Spend: <strong className="text-slate-900 dark:text-white">{formatCurrency(analytics.totalSpendBrl, 'BRL')}</strong>
            </span>
          </div>
        </div>

        {highlightCard(
          'Most Bought Item (Volume & POs)',
          <ShoppingCart className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />,
          analytics.mostBought,
          analytics.mostBought
            ? `${formatNumber(analytics.mostBought.totalOrderedQty, 0)} ${analytics.mostBought.unit}`
            : '-',
          analytics.mostBought
            ? `MAT ${analytics.mostBought.materialCode} · ${analytics.mostBought.poCount} PO(s)`
            : '-'
        )}

        {highlightCard(
          'Most Used Item (Received / Stock)',
          <PackageCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
          analytics.mostUsed,
          analytics.mostUsed
            ? `${formatNumber(analytics.mostUsed.effectiveUsageQty, 0)} ${analytics.mostUsed.unit}`
            : '-',
          analytics.mostUsed
            ? `Rec: ${formatNumber(analytics.mostUsed.totalReceivedQty, 0)} · Plant 0003: ${formatNumber(analytics.mostUsed.totalStockPlant0003, 0)}`
            : '-'
        )}

        {highlightCard(
          'Most Expensive Item (Total Spend)',
          <DollarSign className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
          analytics.mostExpensive,
          analytics.mostExpensive
            ? formatCurrency(analytics.mostExpensive.totalSpendBrl, 'BRL')
            : '-',
          analytics.mostExpensive
            ? `Unit: ${formatCurrency(analytics.mostExpensive.avgUnitPriceBrl, 'BRL')} · ${analytics.mostExpensive.spendSharePct}% share`
            : '-'
        )}
      </div>

      {/* Controls Bar: Ranking Mode + PQR/ABC Filters + Search + Export */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap xl:flex-nowrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950">
            {(
              [
                ['ALL', 'All PQR'],
                ['MOST_BOUGHT', 'Most Bought'],
                ['MOST_USED', 'Most Used'],
                ['MOST_EXPENSIVE', 'Most Expensive'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setRankingMode(mode)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  rankingMode === mode
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by PQR Class"
            value={pqrFilter}
            onChange={(e) => setPqrFilter(e.target.value as 'ALL' | PqrClass)}
            className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            <option value="ALL">All PQR ({analytics.totalSkus})</option>
            <option value="P">P · High Demand ({analytics.pqrCounts.P.count})</option>
            <option value="Q">Q · Medium ({analytics.pqrCounts.Q.count})</option>
            <option value="R">R · Specialized/Low ({analytics.pqrCounts.R.count})</option>
          </select>

          <select
            aria-label="Filter by ABC Spend Class"
            value={abcFilter}
            onChange={(e) => setAbcFilter(e.target.value as 'ALL' | AbcClass)}
            className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            <option value="ALL">All ABC Spend</option>
            <option value="A">Class A · ~80% ({analytics.abcCounts.A.count})</option>
            <option value="B">Class B · ~15% ({analytics.abcCounts.B.count})</option>
            <option value="C">Class C · ~5% ({analytics.abcCounts.C.count})</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Search PQR materials"
              placeholder="Filter material, NCM..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white w-44"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => exportPqrWorkbook(displayedMaterials)}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Export PQR Control.xlsx
        </button>
      </div>

      {/* Pareto Spend & Volume Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              PQR Spend &amp; Demand Concentration (Top Materials in BRL)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sorted by active ranking mode ({rankingMode.replace('_', ' ').toLowerCase()}) · Click any bar or row to inspect POs &amp; stock
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-cyan-500 inline-block" /> Class P (Core)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" /> Class Q (Medium)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-500 inline-block" /> Class R (Low Vol)
            </span>
          </div>
        </div>

        {paretoChartData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
            No material rows match the active filters.
          </div>
        ) : (
          <div className="h-64 text-slate-700 dark:text-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paretoChartData} margin={{ top: 22, right: 12, left: 4, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                <XAxis
                  dataKey="code"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxisBrl}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  formatter={(value: unknown) => [formatCurrency(Number(value), 'BRL'), 'Total Spend']}
                  labelFormatter={(label) => {
                    const match = paretoChartData.find((d) => d.code === label);
                    return match ? `${match.code} — ${match.descShort}` : String(label);
                  }}
                />
                <Bar
                  dataKey="spendBrl"
                  name="Total Spend (BRL)"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    const key = (data as unknown as { materialKey?: string })?.materialKey;
                    if (key) setSelectedMaterialKey(key);
                  }}
                >
                  {paretoChartData.map((entry) => (
                    <Cell key={entry.materialKey} fill={PQR_COLOR[entry.pqrClass]} />
                  ))}
                  <LabelList
                    dataKey="spendBrl"
                    position="top"
                    fill="currentColor"
                    fontSize={10}
                    fontWeight={600}
                    formatter={(val) => formatCompactBrl(Number(val) || 0)}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Main PQR Control Check Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              PQR Material Control Ledger ({displayedMaterials.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Purchased volume, MIGO usage, Plant 0003 stock &amp; spend share · Click Check to audit linked POs
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <ArrowUpDown className="w-3.5 h-3.5" />
            {rankingMode === 'MOST_BOUGHT'
              ? 'Sorted by POs & Ordered Qty'
              : rankingMode === 'MOST_USED'
                ? 'Sorted by Received & Stock Usage'
                : rankingMode === 'MOST_EXPENSIVE'
                  ? 'Sorted by Total Spend (BRL)'
                  : 'Sorted by PQR Class & Spend'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                <th className="py-2.5 px-3 font-medium">Material</th>
                <th className="py-2.5 px-3 font-medium">PQR</th>
                <th className="py-2.5 px-3 font-medium">ABC</th>
                <th className="py-2.5 px-3 font-medium text-right">POs</th>
                <th className="py-2.5 px-3 font-medium text-right">Bought (Ord)</th>
                <th className="py-2.5 px-3 font-medium text-right">Used / Rec</th>
                <th className="py-2.5 px-3 font-medium text-right">Plant 0003</th>
                <th className="py-2.5 px-3 font-medium text-right">Unit Cost</th>
                <th className="py-2.5 px-3 font-medium text-right">Total Spend (BRL)</th>
                <th className="py-2.5 px-3 font-medium text-right">Share</th>
                <th className="py-2.5 px-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {displayedMaterials.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 px-3 text-center text-xs text-slate-500 dark:text-slate-400">
                    No materials match the active PQR filters.
                  </td>
                </tr>
              ) : (
                displayedMaterials.map((mat) => (
                  <tr
                    key={mat.materialKey}
                    onClick={() => setSelectedMaterialKey(mat.materialKey)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 max-w-[260px]">
                      <div className="font-mono font-semibold text-slate-900 dark:text-white">
                        {mat.materialCode}{' '}
                        <span className="font-normal text-[11px] text-slate-400">· {mat.ncm}</span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 truncate" title={mat.descPt}>
                        {mat.descPt}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <StatusBadge label={`Class ${mat.pqrClass}`} tone={PQR_TONE[mat.pqrClass]} />
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <StatusBadge label={mat.abcClass} tone={ABC_TONE[mat.abcClass]} />
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                      {mat.poCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-white whitespace-nowrap">
                      {formatNumber(mat.totalOrderedQty, 0)} {mat.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                      {formatNumber(mat.effectiveUsageQty, 0)} {mat.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatNumber(mat.totalStockPlant0003, 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {formatCurrency(mat.avgUnitPriceBrl, 'BRL')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatCurrency(mat.totalSpendBrl, 'BRL')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {mat.spendSharePct}%
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMaterialKey(mat.materialKey);
                        }}
                        aria-label={`Check material ${mat.materialCode}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Eye className="w-3 h-3" />
                        Check
                      </button>
                    </td>
                  </tr>
                ))
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

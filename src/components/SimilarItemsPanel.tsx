import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CopyCheck,
  DollarSign,
  Download,
  Eye,
  GitCompare,
  Search,
} from 'lucide-react';
import type {
  FupItemRow,
  KraljicOverride,
  MaterialProcurementItem,
  SimilarAuditStatus,
  SimilarGroupDecision,
  SimilarMatchTier,
} from '../types/comex';
import {
  buildMaterialAnalytics,
  detectSimilarMaterials,
} from '../utils/comexEngine';
import { exportSimilarItemsWorkbook } from '../utils/exportReports';
import { formatCurrency, formatNumber } from '../utils/sapParser';
import { MaterialCheckDrawer } from './MaterialCheckDrawer';
import {
  AUDIT_STATUS_META,
  SimilarGroupCheckDrawer,
  TIER_META,
} from './SimilarGroupCheckDrawer';
import { StatusBadge } from './StatusBadge';
import { useI18n } from '../i18n/I18nContext';
import { fmt } from '../i18n/translations';
import { translateMatchReason } from '../i18n/helpers';

interface SimilarItemsPanelProps {
  items: FupItemRow[];
  kraljicOverrides: Record<string, KraljicOverride>;
  similarDecisions: Record<string, SimilarGroupDecision>;
  onSaveSimilarDecision: (groupId: string, decision: SimilarGroupDecision | null) => void;
  onSaveKraljicOverride: (materialKey: string, override: KraljicOverride | null) => void;
  onSelectProcess: (ref: string) => void;
}

const THRESHOLD_PRESETS: Array<{ value: number; key: 'strict' | 'balanced' | 'broad' }> = [
  { value: 75, key: 'strict' },
  { value: 55, key: 'balanced' },
  { value: 35, key: 'broad' },
];

export const SimilarItemsPanel: React.FC<SimilarItemsPanelProps> = ({
  items,
  kraljicOverrides,
  similarDecisions,
  onSaveSimilarDecision,
  onSaveKraljicOverride,
  onSelectProcess,
}) => {
  const { lang, tr } = useI18n();
  const [minScore, setMinScore] = useState<number>(55);
  const [tierFilter, setTierFilter] = useState<'ALL' | SimilarMatchTier>('ALL');
  const [auditFilter, setAuditFilter] = useState<'ALL' | SimilarAuditStatus>('ALL');
  const [localSearch, setLocalSearch] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [inspectingMaterialKey, setInspectingMaterialKey] = useState<string | null>(null);

  const analytics = useMemo(
    () => buildMaterialAnalytics(items, kraljicOverrides),
    [items, kraljicOverrides]
  );

  const similarityResult = useMemo(
    () => detectSimilarMaterials(analytics.materials, similarDecisions, minScore),
    [analytics.materials, similarDecisions, minScore]
  );

  // Diagnostic preview when active threshold has 0 groups (shows closest pairs >= 15% without polluting KPIs)
  const closestPreview = useMemo(() => {
    if (similarityResult.totalGroups > 0 || analytics.materials.length < 2) return null;
    return detectSimilarMaterials(analytics.materials, similarDecisions, 15);
  }, [similarityResult.totalGroups, analytics.materials, similarDecisions]);

  const displayedGroups = useMemo(() => {
    const q = localSearch.trim().toLowerCase();
    return similarityResult.groups.filter((g) => {
      if (tierFilter !== 'ALL' && g.tier !== tierFilter) return false;
      if (auditFilter !== 'ALL' && g.auditStatus !== auditFilter) return false;
      if (!q) return true;
      const haystack = [
        g.groupId,
        g.anchorTitle,
        ...g.materials.flatMap((m) => [m.materialCode, m.descPt, m.descEn, m.ncm, ...m.suppliers, ...m.poNumbers]),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [similarityResult.groups, tierFilter, auditFilter, localSearch]);

  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) return null;
    return (
      similarityResult.groups.find((g) => g.groupId === selectedGroupId) ||
      closestPreview?.groups.find((g) => g.groupId === selectedGroupId) ||
      null
    );
  }, [selectedGroupId, similarityResult.groups, closestPreview]);

  const inspectingMaterial: MaterialProcurementItem | null = useMemo(
    () => analytics.materials.find((m) => m.materialKey === inspectingMaterialKey) || null,
    [analytics.materials, inspectingMaterialKey]
  );

  return (
    <div className="space-y-5">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr.similar.kpiClustersTitle}</span>
            <CopyCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {similarityResult.totalGroups}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {fmt(tr.similar.kpiClustersMeta, {
                involved: similarityResult.totalMaterialsInvolved,
                total: analytics.totalSkus,
              })}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {fmt(tr.similar.kpiClustersSub, { score: minScore })}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr.similar.kpiRiskTitle}</span>
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
              {similarityResult.exactDuplicateGroups}
            </span>
            <span className="text-xs font-mono tabular-nums text-amber-600 dark:text-amber-300">
              {fmt(tr.similar.kpiHighMatch, { count: similarityResult.highSimilarityGroups })}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {tr.similar.kpiRiskSub}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr.similar.kpiProgressTitle}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {similarityResult.confirmedDuplicateGroups}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {fmt(tr.similar.kpiPendingCheck, { count: similarityResult.pendingGroups })}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {tr.similar.kpiProgressSub}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{tr.similar.kpiSpendTitle}</span>
            <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(similarityResult.totalCombinedSpendBrl, 'BRL')}
            </span>
          </div>
          <div className="mt-2 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {fmt(tr.similar.kpiMaxSpread, { pct: similarityResult.maxPriceSpreadPct })}
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap xl:flex-nowrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950">
            {THRESHOLD_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setMinScore(preset.value)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  minScore === preset.value
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tr.similar.presets[preset.key]}
              </button>
            ))}
          </div>

          <select
            aria-label={tr.similar.tierFilterAria}
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as 'ALL' | SimilarMatchTier)}
            className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            <option value="ALL">{tr.similar.allTiers}</option>
            <option value="EXACT_DUPLICATE">{tr.similar.tierExact}</option>
            <option value="HIGH_SIMILARITY">{tr.similar.tierHigh}</option>
            <option value="POSSIBLE_VARIANT">{tr.similar.tierPossible}</option>
          </select>

          <select
            aria-label={tr.similar.auditFilterAria}
            value={auditFilter}
            onChange={(e) => setAuditFilter(e.target.value as 'ALL' | SimilarAuditStatus)}
            className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            <option value="ALL">{tr.similar.allVerification}</option>
            <option value="PENDING">{tr.similar.auditStatus.PENDING}</option>
            <option value="CONFIRMED_DUPLICATE">{tr.similar.auditStatus.CONFIRMED_DUPLICATE}</option>
            <option value="VALID_VARIANT">{tr.similar.auditStatus.VALID_VARIANT}</option>
            <option value="DISMISSED">{tr.similar.auditStatus.DISMISSED}</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label={tr.similar.searchAria}
              placeholder={tr.similar.searchPlaceholder}
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white w-48"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => exportSimilarItemsWorkbook(displayedGroups)}
          disabled={displayedGroups.length === 0}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed text-white transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          {tr.similar.exportBtn}
        </button>
      </div>

      {/* Main Similar Material Clusters Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {fmt(tr.similar.tableTitle, { count: displayedGroups.length })}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tr.similar.tableSubtitle}
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {fmt(tr.similar.skusScanned, { count: analytics.totalSkus })}
          </span>
        </div>

        {displayedGroups.length === 0 ? (
          <div className="p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {fmt(tr.similar.emptyTitle, { score: minScore })}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {similarityResult.totalGroups === 0
                    ? fmt(tr.similar.emptyCleanDesc, { total: analytics.totalSkus })
                    : tr.similar.emptyFilteredDesc}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {minScore > 35 && similarityResult.totalGroups === 0 && (
                  <button
                    type="button"
                    onClick={() => setMinScore(35)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    {tr.similar.tryBroadBtn}
                  </button>
                )}
                {(tierFilter !== 'ALL' || auditFilter !== 'ALL' || localSearch) && (
                  <button
                    type="button"
                    onClick={() => {
                      setTierFilter('ALL');
                      setAuditFilter('ALL');
                      setLocalSearch('');
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white whitespace-nowrap"
                  >
                    {tr.similar.clearTableFilters}
                  </button>
                )}
              </div>
            </div>

            {/* Diagnostic preview of closest pairs when dataset is clean */}
            {closestPreview && closestPreview.groups.length > 0 && similarityResult.totalGroups === 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {tr.similar.previewTitle}
                  </span>
                  <span>{tr.similar.previewHint}</span>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        <th className="py-2 px-3 font-medium">{tr.similar.colMatch}</th>
                        <th className="py-2 px-3 font-medium">{tr.similar.colCodesDescs}</th>
                        <th className="py-2 px-3 font-medium">{tr.similar.colSignalsDiffs}</th>
                        <th className="py-2 px-3 font-medium text-right">{tr.similar.colCombinedSpend}</th>
                        <th className="py-2 px-3 font-medium text-right">{tr.common.action}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                      {closestPreview.groups.slice(0, 5).map((g) => (
                        <tr
                          key={g.groupId}
                          onClick={() => setSelectedGroupId(g.groupId)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                        >
                          <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {g.maxSimilarity}%
                          </td>
                          <td className="py-2.5 px-3 space-y-1">
                            {g.materials.map((m) => (
                              <div key={m.materialCode} className="flex items-baseline gap-2">
                                <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400 shrink-0">
                                  {m.materialCode}
                                </span>
                                <span className="text-slate-700 dark:text-slate-200 truncate max-w-[360px]">
                                  {m.descPt}
                                </span>
                              </div>
                            ))}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-500 dark:text-slate-400">
                            <div>{g.matchReasons.map((r) => translateMatchReason(r, lang)).join(' · ')}</div>
                            {g.specDifferences.length > 0 && (
                              <div className="text-amber-600 dark:text-amber-300 font-mono">
                                {tr.similar.specDiffPrefix} {g.specDifferences.join(' · ')}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                            {formatCurrency(g.combinedSpendBrl, 'BRL')}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGroupId(g.groupId);
                              }}
                              aria-label={fmt(tr.similar.compareAria, { id: g.groupId })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <GitCompare className="w-3 h-3" />
                              {tr.common.compare}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                  <th className="py-2.5 px-3 font-medium">{tr.similar.colMatch}</th>
                  <th className="py-2.5 px-3 font-medium">{tr.similar.colClusterTitle}</th>
                  <th className="py-2.5 px-3 font-medium">{tr.similar.colSignalsShort}</th>
                  <th className="py-2.5 px-3 font-medium text-right">{tr.similar.colBoughtStock}</th>
                  <th className="py-2.5 px-3 font-medium text-right">{tr.similar.colPriceSpread}</th>
                  <th className="py-2.5 px-3 font-medium text-right">{tr.similar.colCombinedSpend}</th>
                  <th className="py-2.5 px-3 font-medium">{tr.similar.colVerification}</th>
                  <th className="py-2.5 px-3 font-medium text-right">{tr.common.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {displayedGroups.map((group) => {
                  const tierMeta = TIER_META[group.tier];
                  const auditMeta = AUDIT_STATUS_META[group.auditStatus];
                  return (
                    <tr
                      key={group.groupId}
                      onClick={() => setSelectedGroupId(group.groupId)}
                      className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap space-y-1">
                        <div className="font-mono tabular-nums font-bold text-sm text-slate-900 dark:text-white">
                          {group.maxSimilarity}%
                        </div>
                        <StatusBadge label={tr.similar.tiers[group.tier]} tone={tierMeta.tone} />
                      </td>
                      <td className="py-2.5 px-3 space-y-1.5 max-w-[420px]">
                        {group.materials.map((m) => (
                          <div key={m.materialCode} className="flex items-baseline gap-2 min-w-0">
                            <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400 shrink-0">
                              {m.materialCode}
                            </span>
                            <span className="text-slate-800 dark:text-slate-100 truncate" title={m.descPt}>
                              {m.descPt}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 shrink-0">
                              · {m.unit}
                            </span>
                          </div>
                        ))}
                      </td>
                      <td className="py-2.5 px-3 max-w-[230px] text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                        <div>{group.matchReasons.map((r) => translateMatchReason(r, lang)).join(' · ')}</div>
                        {group.specDifferences.length > 0 && (
                          <div className="font-mono text-amber-600 dark:text-amber-300">
                            {tr.similar.specDiffPrefix} {group.specDifferences.join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-slate-900 dark:text-white">
                          {formatNumber(group.combinedOrderedQty, 0)}
                        </div>
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                          {tr.common.stock}: {formatNumber(group.combinedStockPlant0003, 0)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <span
                          className={
                            group.unitPriceSpreadPct >= 20
                              ? 'font-semibold text-rose-600 dark:text-rose-400'
                              : 'text-slate-700 dark:text-slate-200'
                          }
                        >
                          {group.unitPriceSpreadPct}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(group.combinedSpendBrl, 'BRL')}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap space-y-1">
                        <StatusBadge label={tr.similar.auditStatus[group.auditStatus]} tone={auditMeta.tone} />
                        {group.auditNote && (
                          <div className="text-[11px] text-slate-500 max-w-[140px] truncate" title={group.auditNote}>
                            {group.auditNote}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGroupId(group.groupId);
                          }}
                          aria-label={fmt(tr.similar.compareAria, { id: group.groupId })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Eye className="w-3 h-3" />
                          {tr.common.compare}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Side-by-Side Cluster Check Drawer */}
      <SimilarGroupCheckDrawer
        group={selectedGroup}
        onClose={() => setSelectedGroupId(null)}
        onSaveDecision={onSaveSimilarDecision}
        onInspectMaterial={(mat) => {
          setSelectedGroupId(null);
          setInspectingMaterialKey(mat.materialKey);
        }}
        onSelectProcess={onSelectProcess}
      />

      {/* Deep-Dive Individual Material Check Drawer */}
      <MaterialCheckDrawer
        material={inspectingMaterial}
        onClose={() => setInspectingMaterialKey(null)}
        onSaveKraljicOverride={onSaveKraljicOverride}
        onSelectProcess={onSelectProcess}
      />
    </div>
  );
};

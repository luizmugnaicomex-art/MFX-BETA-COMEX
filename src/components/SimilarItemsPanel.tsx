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

interface SimilarItemsPanelProps {
  items: FupItemRow[];
  kraljicOverrides: Record<string, KraljicOverride>;
  similarDecisions: Record<string, SimilarGroupDecision>;
  onSaveSimilarDecision: (groupId: string, decision: SimilarGroupDecision | null) => void;
  onSaveKraljicOverride: (materialKey: string, override: KraljicOverride | null) => void;
  onSelectProcess: (ref: string) => void;
}

const THRESHOLD_PRESETS: Array<{ value: number; label: string }> = [
  { value: 75, label: 'Strict (≥75%)' },
  { value: 55, label: 'Balanced (≥55%)' },
  { value: 35, label: 'Broad (≥35%)' },
];

export const SimilarItemsPanel: React.FC<SimilarItemsPanelProps> = ({
  items,
  kraljicOverrides,
  similarDecisions,
  onSaveSimilarDecision,
  onSaveKraljicOverride,
  onSelectProcess,
}) => {
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
            <span>Similar Item Clusters</span>
            <CopyCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {similarityResult.totalGroups}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {similarityResult.totalMaterialsInvolved} of {analytics.totalSkus} SKUs
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Threshold: ≥{minScore}% similarity
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Exact / High Match Risk</span>
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
              {similarityResult.exactDuplicateGroups}
            </span>
            <span className="text-xs font-mono tabular-nums text-amber-600 dark:text-amber-300">
              +{similarityResult.highSimilarityGroups} high match
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Same item under different SAP codes
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Audit Check Progress</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {similarityResult.confirmedDuplicateGroups}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {similarityResult.pendingGroups} pending check
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Confirmed duplicates flagged for SAP merge
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Cluster Spend &amp; Price Spread</span>
            <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(similarityResult.totalCombinedSpendBrl, 'BRL')}
            </span>
          </div>
          <div className="mt-2 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Max unit price spread: {similarityResult.maxPriceSpreadPct}%
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
                {preset.label}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by Match Tier"
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as 'ALL' | SimilarMatchTier)}
            className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            <option value="ALL">All Match Tiers</option>
            <option value="EXACT_DUPLICATE">Exact / Near Duplicate (≥85%)</option>
            <option value="HIGH_SIMILARITY">High Similarity (65–84%)</option>
            <option value="POSSIBLE_VARIANT">Possible Variant (&lt;65%)</option>
          </select>

          <select
            aria-label="Filter by Verification Status"
            value={auditFilter}
            onChange={(e) => setAuditFilter(e.target.value as 'ALL' | SimilarAuditStatus)}
            className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            <option value="ALL">All Verification States</option>
            <option value="PENDING">Pending Check</option>
            <option value="CONFIRMED_DUPLICATE">Confirmed Duplicate</option>
            <option value="VALID_VARIANT">Valid Variant</option>
            <option value="DISMISSED">Not Similar</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Search similar materials"
              placeholder="Code, desc, NCM..."
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
          Export Similar Items.xlsx
        </button>
      </div>

      {/* Main Similar Material Clusters Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Duplicate &amp; Similar Material Code Clusters ({displayedGroups.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Groups distinct SAP MATERIAL codes with matching PT/EN descriptions, specs, or NCM · Click Compare to verify side-by-side
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {analytics.totalSkus} distinct SKUs scanned
          </span>
        </div>

        {displayedGroups.length === 0 ? (
          <div className="p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  No duplicate or similar material codes detected at ≥{minScore}% similarity
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {similarityResult.totalGroups === 0
                    ? `All ${analytics.totalSkus} material codes in the current filter scope have distinct descriptions and specifications. Upload your full FUP COMEX.xlsx to scan hundreds of SAP SKUs, or switch sensitivity to Broad (≥35%).`
                    : 'No clusters match your active tier, verification status, or search filters.'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {minScore > 35 && similarityResult.totalGroups === 0 && (
                  <button
                    type="button"
                    onClick={() => setMinScore(35)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    Try Broad (≥35%)
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
                    Clear Table Filters
                  </button>
                )}
              </div>
            </div>

            {/* Diagnostic preview of closest pairs when dataset is clean */}
            {closestPreview && closestPreview.groups.length > 0 && similarityResult.totalGroups === 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Closest Material Pairs Below Threshold (Diagnostic Preview)
                  </span>
                  <span>Click Compare to inspect side-by-side differences</span>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        <th className="py-2 px-3 font-medium">Match</th>
                        <th className="py-2 px-3 font-medium">Material Codes &amp; Descriptions</th>
                        <th className="py-2 px-3 font-medium">Shared Signals &amp; Spec Diffs</th>
                        <th className="py-2 px-3 font-medium text-right">Combined Spend</th>
                        <th className="py-2 px-3 font-medium text-right">Action</th>
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
                            <div>{g.matchReasons.join(' · ')}</div>
                            {g.specDifferences.length > 0 && (
                              <div className="text-amber-600 dark:text-amber-300 font-mono">
                                Spec diff: {g.specDifferences.join(' · ')}
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
                              aria-label={`Compare similar cluster ${g.groupId}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <GitCompare className="w-3 h-3" />
                              Compare
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
                  <th className="py-2.5 px-3 font-medium">Match</th>
                  <th className="py-2.5 px-3 font-medium">Codes &amp; Descriptions in Cluster</th>
                  <th className="py-2.5 px-3 font-medium">Signals &amp; Spec Diff</th>
                  <th className="py-2.5 px-3 font-medium text-right">Bought / Stock</th>
                  <th className="py-2.5 px-3 font-medium text-right">Price Spread</th>
                  <th className="py-2.5 px-3 font-medium text-right">Combined Spend</th>
                  <th className="py-2.5 px-3 font-medium">Verification</th>
                  <th className="py-2.5 px-3 font-medium text-right">Action</th>
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
                        <StatusBadge label={tierMeta.label} tone={tierMeta.tone} />
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
                        <div>{group.matchReasons.join(' · ')}</div>
                        {group.specDifferences.length > 0 && (
                          <div className="font-mono text-amber-600 dark:text-amber-300">
                            Spec diff: {group.specDifferences.join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-slate-900 dark:text-white">
                          {formatNumber(group.combinedOrderedQty, 0)}
                        </div>
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                          Stock: {formatNumber(group.combinedStockPlant0003, 0)}
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
                        <StatusBadge label={auditMeta.label} tone={auditMeta.tone} />
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
                          aria-label={`Compare similar cluster ${group.groupId}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Eye className="w-3 h-3" />
                          Compare
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

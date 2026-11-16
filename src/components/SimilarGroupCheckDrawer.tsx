import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  GitCompare,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';
import type {
  MaterialProcurementItem,
  SimilarAuditStatus,
  SimilarGroupDecision,
  SimilarMaterialGroup,
  SimilarMatchTier,
} from '../types/comex';
import { tokenizeMaterialText } from '../utils/comexEngine';
import { formatCurrency, formatNumber } from '../utils/sapParser';
import { StatusBadge } from './StatusBadge';

export const TIER_META: Record<
  SimilarMatchTier,
  { label: string; tone: 'rose' | 'amber' | 'cyan' }
> = {
  EXACT_DUPLICATE: { label: 'Exact / Near Duplicate', tone: 'rose' },
  HIGH_SIMILARITY: { label: 'High Similarity', tone: 'amber' },
  POSSIBLE_VARIANT: { label: 'Possible Variant', tone: 'cyan' },
};

export const AUDIT_STATUS_META: Record<
  SimilarAuditStatus,
  { label: string; tone: 'slate' | 'rose' | 'emerald' | 'cyan' }
> = {
  PENDING: { label: 'Pending Check', tone: 'slate' },
  CONFIRMED_DUPLICATE: { label: 'Confirmed Duplicate', tone: 'rose' },
  VALID_VARIANT: { label: 'Valid Variant', tone: 'emerald' },
  DISMISSED: { label: 'Not Similar', tone: 'cyan' },
};

interface SimilarGroupCheckDrawerProps {
  group: SimilarMaterialGroup | null;
  onClose: () => void;
  onSaveDecision: (groupId: string, decision: SimilarGroupDecision | null) => void;
  onInspectMaterial: (material: MaterialProcurementItem) => void;
  onSelectProcess: (ref: string) => void;
}

export const SimilarGroupCheckDrawer: React.FC<SimilarGroupCheckDrawerProps> = ({
  group,
  onClose,
  onSaveDecision,
  onInspectMaterial,
  onSelectProcess,
}) => {
  const [statusDraft, setStatusDraft] = useState<SimilarAuditStatus>('PENDING');
  const [primaryCodeDraft, setPrimaryCodeDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    if (!group) return;
    setStatusDraft(group.auditStatus);
    setPrimaryCodeDraft(group.primaryMaterialCode || group.materials[0]?.materialCode || '');
    setNoteDraft(group.auditNote || '');
  }, [group]);

  useEffect(() => {
    if (!group) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [group, onClose]);

  if (!group) return null;

  const tierMeta = TIER_META[group.tier];
  const auditMeta = AUDIT_STATUS_META[group.auditStatus];
  const sharedSet = new Set(group.sharedTokens);
  const hasSavedDecision = group.auditStatus !== 'PENDING' || Boolean(group.auditNote);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveDecision(group.groupId, {
      status: statusDraft,
      primaryMaterialCode: primaryCodeDraft,
      note: noteDraft.trim(),
      updatedAt: new Date().toISOString().slice(0, 10),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Compare similar materials ${group.groupId}`}
    >
      <div
        className="w-full max-w-5xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto p-6 shadow-2xl space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1 font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                <GitCompare className="w-3.5 h-3.5" />
                {group.materials.length} Material Codes
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                {group.maxSimilarity}% max match
              </span>
              <StatusBadge label={tierMeta.label} tone={tierMeta.tone} />
              <StatusBadge label={auditMeta.label} tone={auditMeta.tone} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {group.anchorTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Signals: {group.matchReasons.join(' · ') || 'Text overlap'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close similar items drawer"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Combined Spend (BRL)</div>
            <div className="mt-1 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(group.combinedSpendBrl, 'BRL')}
            </div>
            <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-500">
              Across {group.materials.length} codes
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Unit Price Spread</div>
            <div
              className={`mt-1 text-sm font-bold font-mono tabular-nums ${
                !group.sameUnit
                  ? 'text-slate-600 dark:text-slate-300'
                  : group.unitPriceSpreadPct >= 20
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-white'
              }`}
            >
              {group.sameUnit ? `${group.unitPriceSpreadPct}%` : 'Mixed UM'}
            </div>
            <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-500">
              {group.sameUnit
                ? `${formatCurrency(group.minUnitPriceBrl, 'BRL')} – ${formatCurrency(group.maxUnitPriceBrl, 'BRL')}`
                : 'Different units of measure'}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Combined Bought Qty</div>
            <div className="mt-1 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatNumber(group.combinedOrderedQty, 0)}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {group.sameUnit ? `Same UM (${group.materials[0]?.unit})` : 'Mixed units'}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Combined Plant 0003</div>
            <div className="mt-1 text-sm font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
              {formatNumber(group.combinedStockPlant0003, 0)}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {group.sameNcm ? `Same NCM ${group.materials[0]?.ncm}` : 'Different NCMs'}
            </div>
          </div>
        </div>

        {/* Spec Difference Warning if detected */}
        {group.specDifferences.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Numeric / Rating Difference Detected:</span>{' '}
              <span className="font-mono">{group.specDifferences.join(' · ')}</span> — verify
              whether these codes represent different technical ratings or a SAP master entry error.
            </div>
          </div>
        )}

        {/* Side-by-Side SAP Material Comparison Table */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                Side-by-Side Material Code Comparison ({group.materials.length})
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Highlighted tokens show matching terms vs. differing terms across SAP material codes
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                  <th className="py-2 px-2.5 font-medium">SAP Code</th>
                  <th className="py-2 px-2.5 font-medium">Descriptions &amp; Token Diff</th>
                  <th className="py-2 px-2.5 font-medium">NCM / UM</th>
                  <th className="py-2 px-2.5 font-medium">Suppliers &amp; POs</th>
                  <th className="py-2 px-2.5 font-medium text-right">Bought / Stock</th>
                  <th className="py-2 px-2.5 font-medium text-right">Unit Cost</th>
                  <th className="py-2 px-2.5 font-medium text-right">Spend (BRL)</th>
                  <th className="py-2 px-2.5 font-medium text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {group.materials.map((mat) => {
                  const isPrimary = mat.materialCode === primaryCodeDraft;
                  const isLowestCost =
                    group.sameUnit &&
                    group.minUnitPriceBrl > 0 &&
                    Math.abs(mat.avgUnitPriceBrl - group.minUnitPriceBrl) < 0.01 &&
                    group.unitPriceSpreadPct > 0;
                  const isHighestCost =
                    group.sameUnit &&
                    group.maxUnitPriceBrl > 0 &&
                    Math.abs(mat.avgUnitPriceBrl - group.maxUnitPriceBrl) < 0.01 &&
                    group.unitPriceSpreadPct > 0;
                  const matTokens = tokenizeMaterialText(`${mat.descPt} ${mat.descEn}`);
                  const uniqueTokens = matTokens.filter((t) => !sharedSet.has(t));

                  return (
                    <tr key={mat.materialKey} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          {mat.materialCode}
                        </div>
                        {isPrimary && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Primary
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 max-w-[260px] space-y-1">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {mat.descPt}
                        </div>
                        {mat.descEn && mat.descEn !== '-' && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {mat.descEn}
                          </div>
                        )}
                        {uniqueTokens.length > 0 && (
                          <div className="text-[10px] text-amber-700 dark:text-amber-300 font-mono">
                            Unique terms: {uniqueTokens.slice(0, 6).map((t) => t.toUpperCase()).join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 whitespace-nowrap font-mono">
                        <div className="text-slate-800 dark:text-slate-200">{mat.ncm}</div>
                        <div className="text-[11px] text-slate-500">UM: {mat.unit}</div>
                      </td>
                      <td className="py-2.5 px-2.5 max-w-[165px] space-y-1">
                        <div className="truncate text-slate-700 dark:text-slate-200" title={mat.suppliers.join(', ')}>
                          {mat.suppliers.join(', ') || '-'}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {mat.poCount} PO ({mat.poNumbers.slice(0, 2).join(', ')}
                          {mat.poNumbers.length > 2 ? '…' : ''})
                        </div>
                        {mat.processRefs.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {mat.processRefs.slice(0, 2).map((ref) => (
                              <button
                                key={ref}
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onSelectProcess(ref);
                                }}
                                className="inline-flex items-center gap-0.5 font-mono text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline"
                              >
                                {ref}
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-slate-900 dark:text-white">
                          {formatNumber(mat.totalOrderedQty, 0)} {mat.unit}
                        </div>
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                          Stock: {formatNumber(mat.totalStockPlant0003, 0)}
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                        <div
                          className={`font-semibold ${
                            isHighestCost
                              ? 'text-rose-600 dark:text-rose-400'
                              : isLowestCost
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {formatCurrency(mat.avgUnitPriceBrl, 'BRL')}
                        </div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          per {mat.unit}
                        </div>
                        {isLowestCost && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                            Lowest unit
                          </div>
                        )}
                        {isHighestCost && (
                          <div className="text-[10px] text-rose-600 dark:text-rose-400">
                            Highest unit
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(mat.totalSpendBrl, 'BRL')}
                      </td>
                      <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onInspectMaterial(mat)}
                          className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          POs
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Verification & SAP Master Standardization Decision Form */}
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                Duplicate SKU Verification &amp; SAP Standardization Decision
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Record whether these SAP material codes should be merged or kept as separate variants
              </div>
            </div>
            {hasSavedDecision && (
              <button
                type="button"
                onClick={() => {
                  onSaveDecision(group.groupId, null);
                  onClose();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Pending
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Verification Decision
              </label>
              <select
                aria-label="Verification Decision"
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value as SimilarAuditStatus)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="PENDING">Pending Check</option>
                <option value="CONFIRMED_DUPLICATE">Confirmed Duplicate (Merge in SAP)</option>
                <option value="VALID_VARIANT">Valid Variant (Keep Separate)</option>
                <option value="DISMISSED">Not Similar (Dismiss)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Keep Primary SAP Code
              </label>
              <select
                aria-label="Primary SAP Code"
                value={primaryCodeDraft}
                onChange={(e) => setPrimaryCodeDraft(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                {group.materials.map((m) => (
                  <option key={m.materialCode} value={m.materialCode}>
                    {m.materialCode} ({formatCurrency(m.totalSpendBrl, 'BRL')})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Audit Note / MDM Ticket
              </label>
              <input
                type="text"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="e.g. Same item, block old code in MM02..."
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save Verification
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

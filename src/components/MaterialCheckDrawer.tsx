import React, { useEffect, useState } from 'react';
import { ExternalLink, RotateCcw, Save, X } from 'lucide-react';
import type {
  KraljicOverride,
  KraljicQuadrant,
  MaterialProcurementItem,
} from '../types/comex';
import { formatCurrency, formatDateBr, formatNumber } from '../utils/sapParser';
import { StatusBadge, getDeliveryStatusTone } from './StatusBadge';

export const KRALJIC_META: Record<
  KraljicQuadrant,
  {
    label: string;
    ptLabel: string;
    tone: 'rose' | 'emerald' | 'amber' | 'slate';
    color: string;
    subtitle: string;
  }
> = {
  STRATEGIC: {
    label: 'Strategic',
    ptLabel: 'Estratégicos',
    tone: 'rose',
    color: '#f43f5e',
    subtitle: 'High Profit Impact · High Supply Risk',
  },
  LEVERAGE: {
    label: 'Leverage',
    ptLabel: 'Alavancagem',
    tone: 'emerald',
    color: '#10b981',
    subtitle: 'High Profit Impact · Low Supply Risk',
  },
  BOTTLENECK: {
    label: 'Bottleneck',
    ptLabel: 'Gargalo',
    tone: 'amber',
    color: '#f59e0b',
    subtitle: 'Low Profit Impact · High Supply Risk',
  },
  NON_CRITICAL: {
    label: 'Non-Critical',
    ptLabel: 'Não Críticos',
    tone: 'slate',
    color: '#64748b',
    subtitle: 'Low Profit Impact · Low Supply Risk',
  },
};

interface MaterialCheckDrawerProps {
  material: MaterialProcurementItem | null;
  onClose: () => void;
  onSaveKraljicOverride?: (materialKey: string, override: KraljicOverride | null) => void;
  onSelectProcess: (ref: string) => void;
}

export const MaterialCheckDrawer: React.FC<MaterialCheckDrawerProps> = ({
  material,
  onClose,
  onSaveKraljicOverride,
  onSelectProcess,
}) => {
  const [quadrantDraft, setQuadrantDraft] = useState<KraljicQuadrant>('NON_CRITICAL');
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    if (!material) return;
    setQuadrantDraft(material.kraljicQuadrant);
    setNoteDraft(material.overrideNote || '');
  }, [material]);

  useEffect(() => {
    if (!material) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [material, onClose]);

  if (!material) return null;

  const qMeta = KRALJIC_META[material.kraljicQuadrant];
  const isOverridden =
    material.kraljicQuadrant !== material.computedQuadrant || Boolean(material.overrideNote);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveKraljicOverride) return;
    onSaveKraljicOverride(material.materialKey, {
      quadrant: quadrantDraft,
      note: noteDraft.trim(),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Inspect material ${material.materialCode}`}
    >
      <div
        className="w-full max-w-3xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto p-6 shadow-2xl space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                MAT {material.materialCode}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">NCM {material.ncm}</span>
              <span aria-hidden="true">·</span>
              <span>UM {material.unit}</span>
              <span aria-hidden="true">·</span>
              <span>PQR {material.pqrClass} / ABC {material.abcClass}</span>
            </div>
            <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
              {material.descPt}
            </h3>
            {material.descEn && material.descEn !== '-' && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{material.descEn}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close material check drawer"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Total Spend (BRL)</div>
            <div className="mt-1 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(material.totalSpendBrl, 'BRL')}
            </div>
            <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-500">
              {material.spendSharePct}% share
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Avg Unit Cost</div>
            <div className="mt-1 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(material.avgUnitPriceBrl, 'BRL')}
            </div>
            <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-500">
              per {material.unit}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Bought / Ordered</div>
            <div className="mt-1 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatNumber(material.totalOrderedQty, 0)} {material.unit}
            </div>
            <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-500">
              {material.poCount} PO{material.poCount === 1 ? '' : 's'} ({material.lineCount} line{material.lineCount === 1 ? '' : 's'})
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Used / Plant 0003</div>
            <div className="mt-1 text-sm font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
              {formatNumber(material.effectiveUsageQty, 0)} {material.unit}
            </div>
            <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-500">
              Pending: {formatNumber(material.totalPendingQty, 0)}
            </div>
          </div>
        </div>

        {/* Plant 0003 Stock & Kraljic Risk Profile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              Plant 0003 Inventory Breakdown
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs pt-1">
              <div>
                <div className="text-slate-500 dark:text-slate-400">Free</div>
                <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {formatNumber(material.stockFree, 0)}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Quality</div>
                <div className="font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-300">
                  {formatNumber(material.stockQuality, 0)}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Blocked</div>
                <div className="font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                  {formatNumber(material.stockBlocked, 0)}
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
              Projects: {material.pepProjects.join(', ') || '-'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                Kraljic Risk &amp; Impact Profile
              </span>
              <StatusBadge label={`${qMeta.label} (${qMeta.ptLabel})`} tone={qMeta.tone} />
            </div>
            <div className="flex items-center gap-4 text-xs font-mono tabular-nums pt-1">
              <span>
                Impact: <strong className="text-slate-900 dark:text-white">{material.profitImpactScore}/100</strong>
              </span>
              <span>
                Supply Risk: <strong className="text-slate-900 dark:text-white">{material.supplyRiskScore}/100</strong>
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Drivers: {material.riskDrivers.join(' · ') || 'Low supply friction'}
            </div>
          </div>
        </div>

        {/* Optional Kraljic Classification Override */}
        {onSaveKraljicOverride && (
          <form
            onSubmit={handleSave}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  Kraljic Classification Check &amp; Calibration
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Auto-computed from SAP spend &amp; risk:{' '}
                  <strong className="text-slate-700 dark:text-slate-200">
                    {KRALJIC_META[material.computedQuadrant].label}
                  </strong>
                </div>
              </div>
              {isOverridden && (
                <button
                  type="button"
                  onClick={() => {
                    onSaveKraljicOverride(material.materialKey, null);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Auto
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Kraljic Quadrant
                </label>
                <select
                  aria-label="Kraljic Quadrant Override"
                  value={quadrantDraft}
                  onChange={(e) => setQuadrantDraft(e.target.value as KraljicQuadrant)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="STRATEGIC">Strategic (Estratégicos)</option>
                  <option value="LEVERAGE">Leverage (Alavancagem)</option>
                  <option value="BOTTLENECK">Bottleneck (Gargalo)</option>
                  <option value="NON_CRITICAL">Non-Critical (Não Críticos)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Verification Note / Action Plan
                </label>
                <input
                  type="text"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="e.g. Dual-source qualification Q1 / AC renewal pending..."
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
                Save Classification
              </button>
            </div>
          </form>
        )}

        {/* Linked SAP POs & MFX Shipments Table */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
              Linked Purchase Orders &amp; MFX Shipments ({material.items.length})
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Inspect every SAP PO line and click any MFX reference to open its shipment record
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                  <th className="py-2 px-2.5 font-medium">PO / Date</th>
                  <th className="py-2 px-2.5 font-medium">Supplier</th>
                  <th className="py-2 px-2.5 font-medium">MFX Ref</th>
                  <th className="py-2 px-2.5 font-medium text-right">Ord / Rec</th>
                  <th className="py-2 px-2.5 font-medium text-right">Value</th>
                  <th className="py-2 px-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {material.items.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      <div className="font-mono font-semibold text-slate-900 dark:text-white">
                        {row.PEDIDO} <span className="text-slate-400 font-normal">/{row.ITEM_PEDIDO}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {formatDateBr(row.DATA_PEDIDO)}
                      </div>
                    </td>
                    <td className="py-2 px-2.5 max-w-[130px] truncate text-slate-700 dark:text-slate-200" title={row.NOME_FORNECEDOR || '-'}>
                      {row.NOME_FORNECEDOR || '-'}
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      {row.ULTIMO_PROCESSO_IMPORTACAO ? (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectProcess(row.ULTIMO_PROCESSO_IMPORTACAO);
                          }}
                          className="inline-flex items-center gap-1 font-mono text-cyan-600 dark:text-cyan-400 hover:underline"
                        >
                          {row.ULTIMO_PROCESSO_IMPORTACAO}
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-slate-400">Open PO</span>
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                      <span className="text-slate-900 dark:text-white">
                        {formatNumber(row.QUANTIDADE_PEDIDA, 0)}
                      </span>
                      <span className="text-slate-400"> / </span>
                      <span className="text-emerald-600 dark:text-emerald-300">
                        {formatNumber(row.QUANTIDADE_RECEBIDA_LIQUIDA, 0)}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-800 dark:text-slate-100">
                      {formatCurrency(row.VALOR_LIQUIDO, row.MOEDA)}
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      <StatusBadge
                        label={row.STATUS_PRAZO_ENTREGA}
                        tone={getDeliveryStatusTone(row.STATUS_PRAZO_ENTREGA)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

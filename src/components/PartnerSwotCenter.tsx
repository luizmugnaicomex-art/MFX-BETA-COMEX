import React, { useMemo, useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import type {
  FupItemRow,
  PartnerCategory,
  PartnerScorecard,
  ShipmentProcessRow,
  SwotData,
} from '../types/comex';
import { buildPartnerScorecards } from '../utils/comexEngine';
import { formatCurrency, formatNumber } from '../utils/sapParser';
import { exportSwotPdf } from '../utils/exportReports';
import { StatusBadge } from './StatusBadge';
import { useI18n } from '../i18n/I18nContext';
import { fmt } from '../i18n/translations';

interface PartnerSwotCenterProps {
  items: FupItemRow[];
  processes: ShipmentProcessRow[];
  customSwots: Record<string, SwotData>;
  onUpdateSwot: (partnerId: string, next: SwotData) => void;
}

type QuadrantKey = keyof SwotData;

const QUADRANTS: Array<{
  key: QuadrantKey;
  headerClass: string;
  borderClass: string;
}> = [
  {
    key: 'strengths',
    headerClass: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
    borderClass: 'border-emerald-500/30',
  },
  {
    key: 'weaknesses',
    headerClass: 'bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/25',
    borderClass: 'border-rose-500/30',
  },
  {
    key: 'opportunities',
    headerClass: 'bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/25',
    borderClass: 'border-sky-500/30',
  },
  {
    key: 'threats',
    headerClass: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/25',
    borderClass: 'border-amber-500/30',
  },
];

export const PartnerSwotCenter: React.FC<PartnerSwotCenterProps> = ({
  items,
  processes,
  customSwots,
  onUpdateSwot,
}) => {
  const { tr } = useI18n();
  const [categoryFilter, setCategoryFilter] = useState<PartnerCategory>('SUPPLIER');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [draftInputs, setDraftInputs] = useState<Record<QuadrantKey, string>>({
    strengths: '',
    weaknesses: '',
    opportunities: '',
    threats: '',
  });

  const scorecards = useMemo(() => buildPartnerScorecards(items, processes), [items, processes]);

  const categoryCards = useMemo(
    () =>
      scorecards
        .filter((c) => c.category === categoryFilter)
        .sort((a, b) => b.totalValueBrl - a.totalValueBrl),
    [scorecards, categoryFilter]
  );

  const selectedPartner: PartnerScorecard | null = useMemo(() => {
    if (!categoryCards.length) return null;
    return categoryCards.find((c) => c.id === selectedPartnerId) || categoryCards[0];
  }, [categoryCards, selectedPartnerId]);

  const activeSwot: SwotData = useMemo(() => {
    if (!selectedPartner) {
      return { strengths: [], weaknesses: [], opportunities: [], threats: [] };
    }
    return customSwots[selectedPartner.id] || selectedPartner.autoSwot;
  }, [selectedPartner, customSwots]);

  const handleAddBullet = (quadrant: QuadrantKey) => {
    if (!selectedPartner) return;
    const text = draftInputs[quadrant].trim();
    if (!text) return;
    const next: SwotData = {
      ...activeSwot,
      [quadrant]: [...activeSwot[quadrant], text],
    };
    onUpdateSwot(selectedPartner.id, next);
    setDraftInputs((prev) => ({ ...prev, [quadrant]: '' }));
  };

  const handleRemoveBullet = (quadrant: QuadrantKey, index: number) => {
    if (!selectedPartner) return;
    const next: SwotData = {
      ...activeSwot,
      [quadrant]: activeSwot[quadrant].filter((_, i) => i !== index),
    };
    onUpdateSwot(selectedPartner.id, next);
  };

  return (
    <div className="space-y-6">
      {/* Category Selector & Partner Scorecard Ranking */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg">
            {(['SUPPLIER', 'FORWARDER', 'BROKER'] as PartnerCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setCategoryFilter(cat);
                  setSelectedPartnerId('');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === cat
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tr.partners.categories[cat]}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400">
            {tr.partners.clickHint}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                <th className="py-2.5 px-3 font-medium">{tr.partners.colPartnerName}</th>
                <th className="py-2.5 px-3 font-medium text-right">
                  {categoryFilter === 'SUPPLIER' ? tr.partners.colPos : tr.partners.colProcesses}
                </th>
                <th className="py-2.5 px-3 font-medium text-right">{tr.partners.colVolume}</th>
                {categoryFilter === 'SUPPLIER' && (
                  <>
                    <th className="py-2.5 px-3 font-medium text-right">{tr.partners.colOpenQty}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{tr.partners.colOnTimePct}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{tr.partners.colAvgDelay}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{tr.partners.colDrawbackPct}</th>
                  </>
                )}
                {categoryFilter === 'FORWARDER' && (
                  <>
                    <th className="py-2.5 px-3 font-medium text-right">{tr.partners.colAirSea}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{tr.partners.colAvgTt}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{tr.partners.colFreightPct}</th>
                  </>
                )}
                {categoryFilter === 'BROKER' && (
                  <>
                    <th className="py-2.5 px-3 font-medium text-right">{tr.partners.colAirSea}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{tr.partners.colAvgClearance}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{tr.partners.colAvgStoragePeriods}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 whitespace-nowrap">
              {categoryCards.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
                    {tr.partners.emptyTable}
                  </td>
                </tr>
              ) : (
                categoryCards.map((card) => {
                  const isSelected = selectedPartner?.id === card.id;
                  return (
                    <tr
                      key={card.id}
                      onClick={() => setSelectedPartnerId(card.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-cyan-500/10 dark:bg-cyan-500/15'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      {card.name}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{card.poOrProcessCount}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatCurrency(card.totalValueBrl, 'BRL')}
                    </td>
                    {categoryFilter === 'SUPPLIER' && (
                      <>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {formatNumber(card.openQty, 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          <StatusBadge
                            label={`${card.onTimeRate}%`}
                            tone={card.onTimeRate >= 80 ? 'emerald' : card.onTimeRate >= 60 ? 'amber' : 'rose'}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {card.avgDelayDays}d
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {card.drawbackCoverageRate}%
                        </td>
                      </>
                    )}
                    {categoryFilter === 'FORWARDER' && (
                      <>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {fmt(tr.partners.airSeaValue, { air: card.airCount, sea: card.seaCount })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {card.avgTransitTime}d
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {card.freightPctOverFob}%
                        </td>
                      </>
                    )}
                    {categoryFilter === 'BROKER' && (
                      <>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {fmt(tr.partners.airSeaValue, { air: card.airCount, sea: card.seaCount })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {card.avgClearanceDays}d
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {card.storagePeriodIncidence}
                        </td>
                      </>
                    )}
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive 2x2 SWOT Analysis Matrix */}
      {selectedPartner && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400">
                {fmt(tr.partners.boardEyebrow, { category: tr.partners.categories[selectedPartner.category] })}
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {selectedPartner.name}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <select
                aria-label={tr.partners.selectPartnerAria}
                value={selectedPartner.id}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {categoryCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => exportSwotPdf(selectedPartner, activeSwot)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white whitespace-nowrap shrink-0"
              >
                <FileText className="w-3.5 h-3.5" />
                {tr.partners.exportPdf}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {QUADRANTS.map((q) => {
              const bullets = activeSwot[q.key];
              const qMeta = tr.partners.quadrants[q.key];
              return (
                <div
                  key={q.key}
                  className={`rounded-xl border ${q.borderClass} bg-slate-50/70 dark:bg-slate-950/60 p-4 flex flex-col justify-between gap-3`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${q.headerClass}`}>
                        {qMeta.title}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {fmt(tr.partners.itemsCount, { count: bullets.length })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">{qMeta.subtitle}</p>

                    <ul className="space-y-2">
                      {bullets.map((b, idx) => (
                        <li
                          key={idx}
                          className="flex items-start justify-between gap-2 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2"
                        >
                          <span>{b}</span>
                          <button
                            type="button"
                            aria-label={fmt(tr.partners.removeNoteAria, { quadrant: qMeta.short, index: idx + 1 })}
                            onClick={() => handleRemoveBullet(q.key, idx)}
                            className="text-slate-400 hover:text-rose-500 shrink-0 mt-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <input
                      type="text"
                      placeholder={fmt(tr.partners.addPlaceholder, { quadrant: qMeta.short })}
                      value={draftInputs[q.key]}
                      onChange={(e) =>
                        setDraftInputs((prev) => ({ ...prev, [q.key]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddBullet(q.key);
                        }
                      }}
                      className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddBullet(q.key)}
                      aria-label={fmt(tr.partners.addNoteAria, { quadrant: qMeta.short })}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {tr.common.add}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

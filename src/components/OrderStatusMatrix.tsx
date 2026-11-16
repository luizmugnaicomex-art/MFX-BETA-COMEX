import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { FupItemRow, ShipmentOverrides } from '../types/comex';
import { buildOrderStatusMatrix } from '../utils/comexEngine';
import { formatCurrency, formatNumber } from '../utils/sapParser';
import { exportOrderStatusMatrix } from '../utils/exportReports';

interface OrderStatusMatrixProps {
  items: FupItemRow[];
  overrides: Record<string, ShipmentOverrides>;
  qtdAcOverrides: Record<string, number>;
  onUpdateQtdAc: (key: string, value: number) => void;
}

export const OrderStatusMatrix: React.FC<OrderStatusMatrixProps> = ({
  items,
  overrides,
  qtdAcOverrides,
  onUpdateQtdAc,
}) => {
  const [localProjectFilter, setLocalProjectFilter] = useState('');
  const [localMaterialSearch, setLocalMaterialSearch] = useState('');

  const matrix = useMemo(() => buildOrderStatusMatrix(items, overrides), [items, overrides]);

  const filteredSections = useMemo(() => {
    const q = localMaterialSearch.trim().toLowerCase();
    return matrix.sections
      .filter((s) => !localProjectFilter || s.sectionKey === localProjectFilter)
      .map((s) => ({
        ...s,
        materials: s.materials.filter(
          (m) =>
            !q ||
            m.materialCode.toLowerCase().includes(q) ||
            m.descPt.toLowerCase().includes(q) ||
            m.descEn.toLowerCase().includes(q) ||
            m.ncm.toLowerCase().includes(q)
        ),
      }))
      .filter((s) => s.materials.length > 0);
  }, [matrix.sections, localProjectFilter, localMaterialSearch]);

  const totalQtdAc = useMemo(() => {
    let sum = 0;
    for (const sec of filteredSections) {
      for (const m of sec.materials) {
        sum += qtdAcOverrides[m.rowKey] ?? m.qtdAcDefault;
      }
    }
    return sum;
  }, [filteredSections, qtdAcOverrides]);

  return (
    <div className="space-y-4">
      {/* Matrix Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Filter matrix by project"
            value={localProjectFilter}
            onChange={(e) => setLocalProjectFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          >
            <option value="">All PEP Projects ({matrix.sections.length})</option>
            {matrix.sections.map((s) => (
              <option key={s.sectionKey} value={s.sectionKey}>
                {s.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Filter material code, PT/ENG desc, NCM..."
            value={localMaterialSearch}
            onChange={(e) => setLocalMaterialSearch(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 w-64"
          />

          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Total Allocated QTD AC: <strong className="text-slate-900 dark:text-white">{formatNumber(totalQtdAc, 0)}</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={() => exportOrderStatusMatrix({ ...matrix, sections: filteredSections }, qtdAcOverrides)}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Export Matrix to Excel (.xlsx)
        </button>
      </div>

      {/* Exact 6-Row Metadata Header + Project Section Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {filteredSections.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No matrix rows match the active filters.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[680px]">
            <table className="w-max min-w-full border-collapse text-[11px]">
              <thead className="sticky top-0 z-20 bg-white dark:bg-slate-900">
                {/* Row 1: N# */}
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
                  <td colSpan={6} className="py-1.5 px-3 text-slate-400 italic">
                    01 - Relatório de Status dos Pedidos (Matriz SAP × Embarques)
                  </td>
                  <th className="py-1.5 px-3 text-right font-semibold text-slate-600 dark:text-slate-300 border-x border-slate-200 dark:border-slate-800">
                    N#
                  </th>
                  {matrix.columns.map((col) => (
                    <th key={col.key} className="py-1.5 px-3 text-center font-mono border-r border-slate-200 dark:border-slate-800 min-w-[130px]">
                      <div className="flex items-center justify-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            col.kind === 'BL'
                              ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {col.kind}
                        </span>
                        <span className="text-slate-900 dark:text-white">{col.number}</span>
                      </div>
                    </th>
                  ))}
                  <th className="py-1.5 px-3 text-center font-semibold text-slate-600 dark:text-slate-300">
                    DRAWBACK
                  </th>
                </tr>

                {/* Row 2: Supplier */}
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                  <td colSpan={6} />
                  <th className="py-1 px-3 text-right font-medium text-slate-500 dark:text-slate-400 border-x border-slate-200 dark:border-slate-800">
                    Supplier
                  </th>
                  {matrix.columns.map((col) => (
                    <td key={col.key} className="py-1 px-2 text-center text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 max-w-[150px] truncate" title={col.supplier}>
                      {col.supplier}
                    </td>
                  ))}
                  <td />
                </tr>

                {/* Row 3: Payment */}
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                  <td colSpan={6} />
                  <th className="py-1 px-3 text-right font-medium text-slate-500 dark:text-slate-400 border-x border-slate-200 dark:border-slate-800">
                    Payment
                  </th>
                  {matrix.columns.map((col) => (
                    <td key={col.key} className="py-1 px-2 text-center font-mono text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                      {col.payment}
                    </td>
                  ))}
                  <td />
                </tr>

                {/* Row 4: Adv Value */}
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                  <td colSpan={6} />
                  <th className="py-1 px-3 text-right font-medium text-slate-500 dark:text-slate-400 border-x border-slate-200 dark:border-slate-800">
                    Adv Value
                  </th>
                  {matrix.columns.map((col) => (
                    <td key={col.key} className="py-1 px-2 text-center font-mono tabular-nums text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800">
                      {formatCurrency(col.advValue, col.currency)}
                    </td>
                  ))}
                  <td />
                </tr>

                {/* Row 5: ETD */}
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                  <td colSpan={6} />
                  <th className="py-1 px-3 text-right font-medium text-slate-500 dark:text-slate-400 border-x border-slate-200 dark:border-slate-800">
                    ETD
                  </th>
                  {matrix.columns.map((col) => (
                    <td key={col.key} className="py-1 px-2 text-center font-mono text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                      {col.etd}
                    </td>
                  ))}
                  <td />
                </tr>

                {/* Row 6: ETA */}
                <tr className="border-b border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60">
                  <td colSpan={6} />
                  <th className="py-1 px-3 text-right font-medium text-slate-500 dark:text-slate-400 border-x border-slate-200 dark:border-slate-800">
                    ETA
                  </th>
                  {matrix.columns.map((col) => (
                    <td key={col.key} className="py-1 px-2 text-center font-mono text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                      {col.eta}
                    </td>
                  ))}
                  <td />
                </tr>

                {/* Row 7: Material Columns Header */}
                <tr className="bg-slate-900 text-slate-100 dark:bg-slate-800 border-b border-slate-700 whitespace-nowrap">
                  <th className="py-2 px-3 text-left font-semibold">COD. MATERIAL</th>
                  <th className="py-2 px-3 text-left font-semibold">DESCRIÇÃO MATERIAL - PT</th>
                  <th className="py-2 px-3 text-left font-semibold">DESCRIÇÃO MATERIAL - ENG</th>
                  <th className="py-2 px-3 text-left font-semibold">NCM</th>
                  <th className="py-2 px-3 text-center font-semibold">UM</th>
                  <th className="py-2 px-3 text-right font-semibold">Estoque</th>
                  <th className="py-2 px-3 text-center font-semibold border-x border-slate-700">AC REF</th>
                  {matrix.columns.map((col) => (
                    <th key={col.key} className="py-2 px-3 text-right font-mono font-semibold border-r border-slate-700">
                      QTD ({col.kind})
                    </th>
                  ))}
                  <th className="py-2 px-3 text-right font-semibold">QTD AC</th>
                </tr>
              </thead>

              <tbody>
                {filteredSections.map((sec) => (
                  <React.Fragment key={sec.sectionKey}>
                    {/* Bold Full-Width Project Section Header */}
                    <tr className="bg-indigo-500/10 dark:bg-indigo-500/15 border-y border-indigo-500/25">
                      <td
                        colSpan={7 + matrix.columns.length + 1}
                        className="py-2 px-3 font-display font-bold text-xs text-indigo-800 dark:text-indigo-200"
                      >
                        {sec.label}
                      </td>
                    </tr>

                    {sec.materials.map((mat) => {
                      const acKey = mat.rowKey;
                      const qtdAc = qtdAcOverrides[acKey] ?? mat.qtdAcDefault;

                      return (
                        <tr
                          key={mat.rowKey}
                          className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          <td className="py-2 px-3 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {mat.materialCode}
                          </td>
                          <td className="py-2 px-3 text-slate-800 dark:text-slate-200 max-w-[260px] truncate" title={mat.descPt}>
                            {mat.descPt}
                          </td>
                          <td className="py-2 px-3 text-slate-500 dark:text-slate-400 max-w-[240px] truncate" title={mat.descEn}>
                            {mat.descEn}
                          </td>
                          <td className="py-2 px-3 font-mono whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {mat.ncm}
                          </td>
                          <td className="py-2 px-3 text-center font-mono">{mat.um}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-emerald-700 dark:text-emerald-300">
                            {formatNumber(mat.estoque, 0)}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-500 dark:text-slate-400 border-x border-slate-200 dark:border-slate-800">
                            {mat.acNumber || '-'}
                          </td>
                          {matrix.columns.map((col) => {
                            const qty = mat.quantities[col.key] || 0;
                            return (
                              <td
                                key={col.key}
                                className={`py-2 px-3 text-right font-mono tabular-nums border-r border-slate-100 dark:border-slate-800 ${
                                  qty > 0
                                    ? 'font-semibold text-slate-900 dark:text-white bg-cyan-500/5'
                                    : 'text-slate-300 dark:text-slate-700'
                                }`}
                              >
                                {qty > 0 ? formatNumber(qty, 0) : '-'}
                              </td>
                            );
                          })}
                          <td className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              aria-label={`QTD AC for ${mat.materialCode}`}
                              value={qtdAc}
                              onChange={(e) => onUpdateQtdAc(acKey, Number(e.target.value) || 0)}
                              className="w-20 px-2 py-1 text-right font-mono tabular-nums rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

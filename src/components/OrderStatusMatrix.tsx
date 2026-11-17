import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { FupItemRow, ShipmentOverrides } from '../types/comex';
import { buildOrderStatusMatrix } from '../utils/comexEngine';
import { formatCurrency, formatNumber } from '../utils/sapParser';
import { exportOrderStatusMatrix } from '../utils/exportReports';
import { useI18n } from '../i18n/I18nContext';

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
  const { tr, fmt } = useI18n();
  const [localProjectFilter, setLocalProjectFilter] = useState('');
  const [localMaterialSearch, setLocalMaterialSearch] = useState('');
  const [separateByEtaDate, setSeparateByEtaDate] = useState(false);

  const matrix = useMemo(
    () => buildOrderStatusMatrix(items, overrides, separateByEtaDate),
    [items, overrides, separateByEtaDate]
  );

  const effectiveProjectFilter = useMemo(
    () =>
      matrix.sections.some((s) => s.sectionKey === localProjectFilter)
        ? localProjectFilter
        : '',
    [matrix.sections, localProjectFilter]
  );

  const filteredSections = useMemo(() => {
    const q = localMaterialSearch.trim().toLowerCase();
    return matrix.sections
      .filter((s) => !effectiveProjectFilter || s.sectionKey === effectiveProjectFilter)
      .map((s) => ({
        ...s,
        materials: s.materials.filter(
          (m) =>
            !q ||
            m.materialCode.toLowerCase().includes(q) ||
            m.descPt.toLowerCase().includes(q) ||
            m.descEn.toLowerCase().includes(q) ||
            m.ncm.toLowerCase().includes(q) ||
            m.elementoPep.toLowerCase().includes(q) ||
            m.elementoPepCode.toLowerCase().includes(q)
        ),
      }))
      .filter((s) => s.materials.length > 0);
  }, [matrix.sections, effectiveProjectFilter, localMaterialSearch]);

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
            aria-label={tr.matrix.filterProjectAria}
            value={effectiveProjectFilter}
            onChange={(e) => setLocalProjectFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          >
            <option value="">{fmt(tr.matrix.allProjects, { count: matrix.sections.length })}</option>
            {matrix.sections.map((s) => (
              <option key={s.sectionKey} value={s.sectionKey}>
                {s.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder={tr.matrix.searchPlaceholder}
            value={localMaterialSearch}
            onChange={(e) => setLocalMaterialSearch(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 w-64"
          />

          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer select-none hover:border-cyan-500/60 transition-colors">
            <input
              type="checkbox"
              checked={separateByEtaDate}
              onChange={(e) => setSeparateByEtaDate(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-cyan-600 focus:ring-cyan-500"
            />
            <span>{tr.matrix.separateByEtaDate}</span>
          </label>

          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {tr.matrix.totalAllocatedQtdAc}{' '}
            <strong className="text-slate-900 dark:text-white">{formatNumber(totalQtdAc, 0)}</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={() => exportOrderStatusMatrix({ ...matrix, sections: filteredSections }, qtdAcOverrides)}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          {tr.matrix.exportBtn}
        </button>
      </div>

      {/* Exact 6-Row Metadata Header + Project Section Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {filteredSections.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {tr.matrix.emptyState}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[680px]">
            <table className="w-max min-w-full border-collapse text-[11px]">
              <thead className="sticky top-0 z-20 bg-white dark:bg-slate-900">
                {/* Row 1: N# (plus inline PO & BL/AWB summary for BL cargo and ETA header when separated by date) */}
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
                  <td colSpan={7} className="py-1.5 px-3 text-slate-400 italic">
                    {tr.matrix.reportSubtitle}
                  </td>
                  <th className="py-1.5 px-3 text-right font-semibold text-slate-600 dark:text-slate-300 border-x border-slate-200 dark:border-slate-800">
                    N#
                  </th>
                  {matrix.columns.map((col) => (
                    <th
                      key={col.key}
                      className="py-1.5 px-3 text-center font-mono border-r border-slate-200 dark:border-slate-800 min-w-[150px]"
                    >
                      {separateByEtaDate && (
                        <div className="mb-1 px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 text-[10px] font-bold tracking-tight">
                          ETA: {col.eta}
                        </div>
                      )}
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
                      {col.kind === 'BL' && (
                        <div className="mt-1 space-y-0.5 text-[10px] font-normal leading-tight text-slate-500 dark:text-slate-400">
                          <div className="truncate max-w-[155px] mx-auto" title={`PO: ${col.poNumbers}`}>
                            <span className="font-semibold text-slate-600 dark:text-slate-300">PO:</span>{' '}
                            {col.poNumbers}
                          </div>
                          <div className="truncate max-w-[155px] mx-auto" title={`BL/AWB: ${col.blAwb}`}>
                            <span className="font-semibold text-cyan-700 dark:text-cyan-300">BL/AWB:</span>{' '}
                            {col.blAwb}
                          </div>
                          <div
                            className="truncate max-w-[155px] mx-auto"
                            title={`${tr.matrix.nfDocnumRow}: ${
                              col.nfDocnum !== '-' ? col.nfDocnum : tr.matrix.nfPending
                            }`}
                          >
                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                              {tr.matrix.nfDocnumRow}:
                            </span>{' '}
                            {col.nfDocnum !== '-' ? (
                              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                {col.nfDocnum}
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400">
                                {tr.matrix.nfPending}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </th>
                  ))}
                  <th className="py-1.5 px-3 text-center font-semibold text-slate-600 dark:text-slate-300">
                    DRAWBACK
                  </th>
                </tr>

                {/* Row 2: PO # */}
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                  <td colSpan={7} />
                  <th className="py-1 px-3 text-right font-medium text-slate-500 dark:text-slate-400 border-x border-slate-200 dark:border-slate-800">
                    {tr.matrix.poRow}
                  </th>
                  {matrix.columns.map((col) => (
                    <td
                      key={col.key}
                      className="py-1 px-2 text-center font-mono text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 max-w-[160px] truncate"
                      title={col.poNumbers}
                    >
                      {col.poNumbers}
                    </td>
                  ))}
                  <td />
                </tr>

                {/* Row 3: BL / AWB */}
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                  <td colSpan={7} />
                  <th className="py-1 px-3 text-right font-medium text-slate-500 dark:text-slate-400 border-x border-slate-200 dark:border-slate-800">
                    {tr.matrix.blAwbRow}
                  </th>
                  {matrix.columns.map((col) => (
                    <td
                      key={col.key}
                      className="py-1 px-2 text-center font-mono text-cyan-700 dark:text-cyan-300 border-r border-slate-200 dark:border-slate-800 max-w-[160px] truncate"
                      title={col.blAwb}
                    >
                      {col.blAwb}
                    </td>
                  ))}
                  <td />
                </tr>

                {/* Row 4: NF (DOCNUM) from Col AQ PROCESSOS_JSON */}
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                  <td colSpan={7} />
                  <th className="py-1 px-3 text-right font-medium text-slate-500 dark:text-slate-400 border-x border-slate-200 dark:border-slate-800 whitespace-nowrap">
                    {tr.matrix.nfDocnumRow}
                  </th>
                  {matrix.columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-1 px-2 text-center font-mono border-r border-slate-200 dark:border-slate-800 max-w-[160px] truncate ${
                        col.nfDocnum !== '-'
                          ? 'font-semibold text-emerald-700 dark:text-emerald-300'
                          : col.kind === 'BL'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-400 dark:text-slate-600'
                      }`}
                      title={
                        col.nfDocnum !== '-'
                          ? `${tr.matrix.nfDocnumRow}: ${col.nfDocnum}`
                          : col.kind === 'BL'
                            ? `${tr.matrix.nfDocnumRow}: ${tr.matrix.nfPending}`
                            : '-'
                      }
                    >
                      {col.nfDocnum !== '-'
                        ? col.nfDocnum
                        : col.kind === 'BL'
                          ? tr.matrix.nfPending
                          : '-'}
                    </td>
                  ))}
                  <td />
                </tr>

                {/* Row 4: Supplier */}
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                  <td colSpan={7} />
                  <th className="py-1 px-3 text-right font-medium text-slate-500 dark:text-slate-400 border-x border-slate-200 dark:border-slate-800">
                    {tr.matrix.supplierRow}
                  </th>
                  {matrix.columns.map((col) => (
                    <td key={col.key} className="py-1 px-2 text-center text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 max-w-[160px] truncate" title={col.supplier}>
                      {col.supplier}
                    </td>
                  ))}
                  <td />
                </tr>

                {/* Row 5: Payment */}
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                  <td colSpan={7} />
                  <th className="py-1 px-3 text-right font-medium text-slate-500 dark:text-slate-400 border-x border-slate-200 dark:border-slate-800">
                    {tr.matrix.paymentRow}
                  </th>
                  {matrix.columns.map((col) => (
                    <td key={col.key} className="py-1 px-2 text-center font-mono text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                      {col.payment}
                    </td>
                  ))}
                  <td />
                </tr>

                {/* Row 6: Adv Value */}
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                  <td colSpan={7} />
                  <th className="py-1 px-3 text-right font-medium text-slate-500 dark:text-slate-400 border-x border-slate-200 dark:border-slate-800">
                    {tr.matrix.advValueRow}
                  </th>
                  {matrix.columns.map((col) => (
                    <td key={col.key} className="py-1 px-2 text-center font-mono tabular-nums text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800">
                      {formatCurrency(col.advValue, col.currency)}
                    </td>
                  ))}
                  <td />
                </tr>

                {/* Row 7: ETD */}
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                  <td colSpan={7} />
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

                {/* Row 8: ETA */}
                <tr
                  className={`border-b border-slate-300 dark:border-slate-700 ${
                    separateByEtaDate
                      ? 'bg-cyan-500/10 dark:bg-cyan-500/15'
                      : 'bg-slate-50/70 dark:bg-slate-950/60'
                  }`}
                >
                  <td colSpan={7} />
                  <th
                    className={`py-1 px-3 text-right font-semibold border-x border-slate-200 dark:border-slate-800 ${
                      separateByEtaDate
                        ? 'text-cyan-700 dark:text-cyan-300'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    ETA
                  </th>
                  {matrix.columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-1 px-2 text-center font-mono border-r border-slate-200 dark:border-slate-800 ${
                        separateByEtaDate
                          ? 'font-bold text-cyan-800 dark:text-cyan-200'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {col.eta}
                    </td>
                  ))}
                  <td />
                </tr>

                {/* Row 9: Material Columns Header */}
                <tr className="bg-slate-900 text-slate-100 dark:bg-slate-800 border-b border-slate-700 whitespace-nowrap">
                  <th className="py-2 px-3 text-left font-semibold">{tr.matrix.codMaterial}</th>
                  <th className="py-2 px-3 text-left font-semibold">{tr.matrix.descPt}</th>
                  <th className="py-2 px-3 text-left font-semibold">{tr.matrix.descEn}</th>
                  <th className="py-2 px-3 text-left font-semibold">{tr.common.ncm}</th>
                  <th className="py-2 px-3 text-center font-semibold">UM</th>
                  <th className="py-2 px-3 text-right font-semibold">{tr.matrix.estoque}</th>
                  <th className="py-2 px-3 text-left font-semibold">{tr.matrix.elementoPep}</th>
                  <th className="py-2 px-3 text-center font-semibold border-x border-slate-700">{tr.matrix.acRef}</th>
                  {matrix.columns.map((col) => (
                    <th key={col.key} className="py-2 px-3 text-right font-mono font-semibold border-r border-slate-700">
                      {separateByEtaDate && col.eta !== '-'
                        ? `${col.eta} · ${fmt(tr.matrix.qtdHeader, { kind: col.kind })}`
                        : fmt(tr.matrix.qtdHeader, { kind: col.kind })}
                    </th>
                  ))}
                  <th className="py-2 px-3 text-right font-semibold">QTD AC</th>
                </tr>
              </thead>

              <tbody>
                {filteredSections.map((sec) => (
                  <React.Fragment key={sec.sectionKey}>
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
                          <td
                            className="py-2 px-3 font-medium text-slate-700 dark:text-slate-300 max-w-[210px] truncate"
                            title={
                              mat.elementoPepCode &&
                              mat.elementoPepCode !== '-' &&
                              mat.elementoPepCode !== mat.elementoPep
                                ? `${mat.elementoPep} (${mat.elementoPepCode})`
                                : mat.elementoPep
                            }
                          >
                            {mat.elementoPep}
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
                              aria-label={fmt(tr.matrix.qtdAcInputAria, { code: mat.materialCode })}
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

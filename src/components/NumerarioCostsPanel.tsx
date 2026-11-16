import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
} from 'recharts';
import {
  Calculator,
  DollarSign,
  Download,
  FileText,
  Landmark,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  FupItemRow,
  NumerarioCostLine,
  NumerarioOverride,
  NumerarioSourceType,
  NumerarioTaxRegime,
  ShipmentProcessRow,
} from '../types/comex';
import { buildNumerarioAnalysis } from '../utils/comexEngine';
import { formatCurrency } from '../utils/sapParser';
import {
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
  formatAxisBrl,
  formatCompactBrl,
} from '../utils/chartFormatters';
import { exportNumerarioPdf, exportNumerarioWorkbook } from '../utils/exportReports';
import { StatusBadge } from './StatusBadge';
import {
  FINANCE_STATUS_BADGE,
  NumerarioDetailDrawer,
  REGIME_BADGE,
} from './NumerarioDetailDrawer';

interface NumerarioCostsPanelProps {
  items: FupItemRow[];
  processes: ShipmentProcessRow[];
  numerarioOverrides: Record<string, NumerarioOverride>;
  onSaveNumerarioOverride: (id: string, next: NumerarioOverride | null) => void;
  onSelectProcess: (ref: string) => void;
}

export const NumerarioCostsPanel: React.FC<NumerarioCostsPanelProps> = ({
  items,
  processes,
  numerarioOverrides,
  onSaveNumerarioOverride,
  onSelectProcess,
}) => {
  const [includeOpenPos, setIncludeOpenPos] = useState(true);
  const [regimeFilter, setRegimeFilter] = useState<'ALL' | NumerarioTaxRegime>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | NumerarioSourceType>('ALL');
  const [localSearch, setLocalSearch] = useState('');
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  const analysis = useMemo(
    () => buildNumerarioAnalysis(items, processes, numerarioOverrides, includeOpenPos),
    [items, processes, numerarioOverrides, includeOpenPos]
  );

  const filteredRows = useMemo(() => {
    const q = localSearch.trim().toLowerCase();
    return analysis.rows.filter((r) => {
      if (regimeFilter !== 'ALL' && r.taxRegime !== regimeFilter) return false;
      if (sourceFilter !== 'ALL' && r.sourceType !== sourceFilter) return false;
      if (q) {
        const hay = [
          r.id,
          r.poList,
          r.diNum,
          r.supplier,
          r.pepProject,
          r.ncms,
          r.acNumber,
          r.financeNote,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [analysis.rows, regimeFilter, sourceFilter, localSearch]);

  const filteredTotals = useMemo(() => {
    const sum = (getter: (r: NumerarioCostLine) => number) =>
      filteredRows.reduce((s, r) => s + getter(r), 0);
    return {
      va: sum((r) => r.valorAduaneiroBrl),
      ii: sum((r) => r.iiBrl),
      ipi: sum((r) => r.ipiBrl),
      pis: sum((r) => r.pisBrl),
      cofins: sum((r) => r.cofinsBrl),
      icms: sum((r) => r.icmsBrl),
      siscomexAfrmm: sum((r) => r.siscomexBrl + r.afrmmBrl),
      clearance: sum((r) => r.totalClearanceExpensesBrl),
      totalNumerario: sum((r) => r.totalNumerarioBrl),
      adiantado: sum((r) => r.valorAdiantadoBrl),
      saldo: sum((r) => r.saldoFinanceiroBrl),
    };
  }, [filteredRows]);

  const processChartData = useMemo(
    () =>
      filteredRows.slice(0, 8).map((r) => ({
        name: r.id.startsWith('PO-')
          ? `PO-${r.id.slice(-4)}`
          : r.id.replace('MFX-000', 'MFX-').replace('MFX-00', 'MFX-'),
        taxes: Math.round(r.totalTaxesBrl),
        clearance: Math.round(r.totalClearanceExpensesBrl),
        reqTotal: Math.round(r.totalTaxesBrl + r.totalClearanceExpensesBrl),
        adiantado: Math.round(r.valorAdiantadoBrl),
      })),
    [filteredRows]
  );

  const selectedLine = useMemo(
    () => analysis.rows.find((r) => r.id === selectedLineId) || null,
    [analysis.rows, selectedLineId]
  );

  const exportPayload = useMemo(
    () => ({
      ...analysis,
      rows: filteredRows,
    }),
    [analysis, filteredRows]
  );

  return (
    <div className="space-y-5">
      {/* Executive Numerário KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Expected Numerário</span>
            <Calculator className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(analysis.totals.totalNumerarioBrl, 'BRL')}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span>Taxes: {formatCurrency(analysis.totals.totalTaxesBrl, 'BRL')}</span>
            <span>{analysis.counts.totalRows} items</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Customs Taxes (DI / DUIMP)</span>
            <Landmark className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-cyan-700 dark:text-cyan-300">
            {formatCurrency(analysis.totals.totalTaxesBrl, 'BRL')}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span>{analysis.counts.sapDiCount} SAP DI</span>
            <span>
              {analysis.counts.simulatedCount > 0
                ? `${analysis.counts.simulatedCount} Sim.`
                : `${analysis.counts.preDiCount} Pre-DI`}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Finance Cash Call (Saldo)</span>
            <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              analysis.totals.saldoFinanceiroBrl > 50
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {formatCurrency(analysis.totals.saldoFinanceiroBrl, 'BRL')}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span>Adiantado: {formatCurrency(analysis.totals.valorAdiantadoBrl, 'BRL')}</span>
            <span>{analysis.counts.pendingCashCallCount} open</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              {analysis.totals.drawbackSavedBrl > 0
                ? 'Drawback Tax Avoidance (Sim)'
                : 'Drawback AC Coverage (VA)'}
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(
              analysis.totals.drawbackSavedBrl > 0
                ? analysis.totals.drawbackSavedBrl
                : analysis.totals.drawbackCoveredVaBrl,
              'BRL'
            )}
          </div>
          <div className="mt-2 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 truncate">
            {analysis.totals.potentialSavingsIfAcLinkedBrl > 0
              ? `+${formatCurrency(analysis.totals.potentialSavingsIfAcLinkedBrl, 'BRL')} avoidable w/ AC`
              : `${analysis.counts.drawbackSuspCount} processes under AC`}
          </div>
        </div>
      </div>

      {/* Finance Cost Breakdown Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Numerário Composition by Tax &amp; Expense (BRL)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                II, IPI, PIS, COFINS, ICMS, Siscomex/AFRMM &amp; Port/Brokerage totals
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {formatCurrency(analysis.totals.totalNumerarioBrl, 'BRL')}
            </span>
          </div>
          <div className="h-[235px] text-slate-700 dark:text-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analysis.taxBreakdownChart}
                layout="vertical"
                margin={{ top: 4, right: 118, left: 6, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                <XAxis
                  type="number"
                  tickFormatter={formatAxisBrl}
                  tick={{ fontSize: 10.5, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={104}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(val: unknown) => formatCurrency(Number(val) || 0, 'BRL')}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                />
                <Bar dataKey="valueBrl" name="Cost (BRL)" radius={[0, 4, 4, 0]}>
                  {analysis.taxBreakdownChart.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="valueBrl"
                    position="right"
                    fill="currentColor"
                    fontSize={10.5}
                    fontWeight={600}
                    formatter={(val) => formatCurrency(Number(val) || 0, 'BRL')}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Numerário Requirement vs. Advance Paid per Process (BRL)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Taxes + Port/Brokerage compared against Valor Adiantado (VALOR_ADT)
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-amber-600 dark:text-amber-300 whitespace-nowrap shrink-0">
              {analysis.counts.pendingCashCallCount} pending transfer
            </span>
          </div>
          <div className="h-[235px] text-slate-700 dark:text-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={processChartData}
                margin={{ top: 22, right: 12, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatAxisBrl}
                  tick={{ fontSize: 10.5, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(val: unknown) => formatCurrency(Number(val) || 0, 'BRL')}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar
                  dataKey="taxes"
                  name="Customs Taxes"
                  stackId="req"
                  fill="#06b6d4"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="clearance"
                  name="Port & Broker"
                  stackId="req"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                >
                  <LabelList
                    dataKey="reqTotal"
                    position="top"
                    fill="currentColor"
                    fontSize={9.5}
                    fontWeight={600}
                    formatter={(val) => formatCompactBrl(Number(val) || 0)}
                  />
                </Bar>
                <Bar
                  dataKey="adiantado"
                  name="Advance Paid"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                >
                  <LabelList
                    dataKey="adiantado"
                    position="top"
                    fill="#10b981"
                    fontSize={9.5}
                    fontWeight={600}
                    formatter={(val) => formatCompactBrl(Number(val) || 0)}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap xl:flex-nowrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950">
            <button
              type="button"
              onClick={() => setIncludeOpenPos(false)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                !includeOpenPos
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              MFX Shipments ({processes.length})
            </button>
            <button
              type="button"
              onClick={() => setIncludeOpenPos(true)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                includeOpenPos
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Shipments + Open POs
            </button>
          </div>

          <select
            aria-label="Filter by Tax Regime"
            value={regimeFilter}
            onChange={(e) => setRegimeFilter(e.target.value as 'ALL' | NumerarioTaxRegime)}
            className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            <option value="ALL">All Tax Regimes</option>
            <option value="RECOLHIMENTO_INTEGRAL">Recolhimento Integral</option>
            <option value="AGUARDANDO_AC">Aguardando AC (Pre-DI)</option>
            <option value="DRAWBACK_SUSP">Drawback Suspensão</option>
          </select>

          <select
            aria-label="Filter by Calculation Basis"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as 'ALL' | NumerarioSourceType)}
            className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            <option value="ALL">All Calc Bases</option>
            <option value="SAP_DI">SAP Recorded DI</option>
            <option value="DRAWBACK_SUSPENDED">Drawback AC (SAP)</option>
            <option value="PRE_DI_SAP">Pre-DI (Uploaded SAP)</option>
            <option value="SIMULATED">Simulated (Manual)</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Search Numerario processes"
              placeholder="MFX, PO, DI, NCM..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white w-44"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => exportNumerarioWorkbook(exportPayload)}
            disabled={filteredRows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed text-white transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export Numerário.xlsx
          </button>
          <button
            type="button"
            onClick={() => exportNumerarioPdf(exportPayload)}
            disabled={filteredRows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 disabled:cursor-not-allowed text-white transition-colors whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5" />
            Finance PDF
          </button>
        </div>
      </div>

      {/* Main Finance Numerário Schedule Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Customs Declaration Numerário Cost Schedule ({filteredRows.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Exact uploaded SAP/DI II, IPI, PIS, COFINS, ICMS, Siscomex, AFRMM &amp; port clearance
              costs for Finance · Click any row to inspect or run a manual rate simulation
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Total Saldo: {formatCurrency(filteredTotals.saldo, 'BRL')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[10.5px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                <th className="py-2 px-1.5 font-medium">Process / PO</th>
                <th className="py-2 px-1.5 font-medium">Regime &amp; NCM</th>
                <th className="py-2 px-1.5 font-medium text-right">VA (BRL)</th>
                <th className="py-2 px-1 font-medium text-right">II</th>
                <th className="py-2 px-1 font-medium text-right">IPI</th>
                <th className="py-2 px-1 font-medium text-right">PIS</th>
                <th className="py-2 px-1 font-medium text-right">COFINS</th>
                <th className="py-2 px-1 font-medium text-right">ICMS</th>
                <th className="py-2 px-1.5 font-medium text-right">Port &amp; Fees</th>
                <th className="py-2 px-1.5 font-medium text-right">Numerário</th>
                <th className="py-2 px-1.5 font-medium text-right">Adt / Saldo</th>
                <th className="py-2 px-1 font-medium text-right" aria-label="Details" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="py-10 text-center text-xs text-slate-500 dark:text-slate-400"
                  >
                    No import processes or POs match the current Numerário filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const regimeMeta = REGIME_BADGE[row.taxRegime];
                  const finMeta = FINANCE_STATUS_BADGE[row.financeStatus];
                  const regimeShort =
                    row.taxRegime === 'DRAWBACK_SUSP'
                      ? 'DBK Susp.'
                      : row.taxRegime === 'AGUARDANDO_AC'
                        ? 'Aguard. AC'
                        : 'Rec. Integral';
                  const finShort =
                    row.financeStatus === 'REQUESTED'
                      ? 'Req. Finance'
                      : row.financeStatus === 'APPROVED'
                        ? 'Approved'
                        : row.financeStatus === 'PAID'
                          ? 'Paid'
                          : 'Pre-Req.';
                  const basisShort =
                    row.sourceType === 'SAP_DI'
                      ? 'SAP DI'
                      : row.sourceType === 'DRAWBACK_SUSPENDED'
                        ? 'AC (SAP)'
                        : row.sourceType === 'SIMULATED'
                          ? 'Sim.'
                          : 'Pre-DI';
                  const portAndFees =
                    row.totalClearanceExpensesBrl + row.siscomexBrl + row.afrmmBrl;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedLineId(row.id)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer align-top"
                    >
                      <td className="py-2 px-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold text-cyan-700 dark:text-cyan-300">
                            {row.id}
                          </span>
                          {row.hasOverride && (
                            <span className="text-[10px] font-mono text-amber-600 dark:text-amber-300">
                              (Sim)
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] text-slate-700 dark:text-slate-200 max-w-[105px] truncate">
                          {row.supplier}
                        </div>
                        <div className="text-[9.5px] font-mono text-slate-500 max-w-[105px] truncate">
                          PO {row.poList}
                        </div>
                      </td>

                      <td className="py-2 px-1.5 whitespace-nowrap space-y-0.5">
                        <div className="flex items-center gap-1">
                          <StatusBadge label={regimeShort} tone={regimeMeta.tone} />
                        </div>
                        <div className="flex items-center gap-1 text-[9.5px] font-mono text-slate-500">
                          <span>{row.ncms}</span>
                          <span>·</span>
                          <span>{basisShort}</span>
                        </div>
                        {row.acNumber !== '-' && (
                          <div className="text-[9.5px] font-mono text-emerald-600 dark:text-emerald-400">
                            AC {row.acNumber}
                          </div>
                        )}
                      </td>

                      <td className="py-2 px-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-slate-900 dark:text-white">
                          {formatCurrency(row.valorAduaneiroBrl, 'BRL')}
                        </div>
                        <div className="text-[9.5px] text-slate-500">
                          {formatCurrency(row.fobOrig, row.currency)}
                        </div>
                      </td>

                      <td className="py-2 px-1 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-slate-800 dark:text-slate-200">
                          {formatCurrency(row.iiBrl, 'BRL')}
                        </div>
                        <div className="text-[9.5px] text-slate-500">{row.iiRatePct}%</div>
                      </td>

                      <td className="py-2 px-1 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-slate-800 dark:text-slate-200">
                          {formatCurrency(row.ipiBrl, 'BRL')}
                        </div>
                        <div className="text-[9.5px] text-slate-500">{row.ipiRatePct}%</div>
                      </td>

                      <td className="py-2 px-1 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-slate-800 dark:text-slate-200">
                          {formatCurrency(row.pisBrl, 'BRL')}
                        </div>
                        <div className="text-[9.5px] text-slate-500">{row.pisRatePct}%</div>
                      </td>

                      <td className="py-2 px-1 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-slate-800 dark:text-slate-200">
                          {formatCurrency(row.cofinsBrl, 'BRL')}
                        </div>
                        <div className="text-[9.5px] text-slate-500">{row.cofinsRatePct}%</div>
                      </td>

                      <td className="py-2 px-1 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-slate-800 dark:text-slate-200">
                          {formatCurrency(row.icmsBrl, 'BRL')}
                        </div>
                        <div className="text-[9.5px] text-slate-500">{row.icmsRatePct}%</div>
                      </td>

                      <td className="py-2 px-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-slate-800 dark:text-slate-200">
                          {formatCurrency(portAndFees, 'BRL')}
                        </div>
                        <div className="text-[9.5px] text-slate-500">
                          Sisc {formatCurrency(row.siscomexBrl + row.afrmmBrl, 'BRL')}
                        </div>
                      </td>

                      <td className="py-2 px-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {formatCurrency(row.totalNumerarioBrl, 'BRL')}
                        </div>
                        <div className="mt-0.5">
                          <StatusBadge label={finShort} tone={finMeta.tone} />
                        </div>
                      </td>

                      <td className="py-2 px-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-[9.5px] text-slate-500 dark:text-slate-400">
                          Adt: {formatCurrency(row.valorAdiantadoBrl, 'BRL')}
                        </div>
                        <div
                          className={`font-semibold ${
                            row.saldoFinanceiroBrl > 50
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {row.saldoFinanceiroBrl > 0 ? '+' : ''}
                          {formatCurrency(row.saldoFinanceiroBrl, 'BRL')}
                        </div>
                      </td>

                      <td
                        className="py-2 px-1 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedLineId(row.id)}
                          aria-label={`Details for ${row.id}`}
                          title="Simulate taxes & inspect Numerário"
                          className="inline-flex items-center justify-center p-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-950/80 border-t-2 border-slate-200 dark:border-slate-700 font-bold font-mono tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                  <td className="py-2 px-1.5" colSpan={2}>
                    TOTAL ({filteredRows.length})
                  </td>
                  <td className="py-2 px-1.5 text-right">
                    {formatCurrency(filteredTotals.va, 'BRL')}
                  </td>
                  <td className="py-2 px-1 text-right">
                    {formatCurrency(filteredTotals.ii, 'BRL')}
                  </td>
                  <td className="py-2 px-1 text-right">
                    {formatCurrency(filteredTotals.ipi, 'BRL')}
                  </td>
                  <td className="py-2 px-1 text-right">
                    {formatCurrency(filteredTotals.pis, 'BRL')}
                  </td>
                  <td className="py-2 px-1 text-right">
                    {formatCurrency(filteredTotals.cofins, 'BRL')}
                  </td>
                  <td className="py-2 px-1 text-right">
                    {formatCurrency(filteredTotals.icms, 'BRL')}
                  </td>
                  <td className="py-2 px-1.5 text-right">
                    {formatCurrency(filteredTotals.clearance + filteredTotals.siscomexAfrmm, 'BRL')}
                  </td>
                  <td className="py-2 px-1.5 text-right text-cyan-600 dark:text-cyan-400">
                    {formatCurrency(filteredTotals.totalNumerario, 'BRL')}
                  </td>
                  <td
                    className={`py-2 px-1.5 text-right ${
                      filteredTotals.saldo > 50
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {formatCurrency(filteredTotals.saldo, 'BRL')}
                  </td>
                  <td className="py-2 px-1" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Interactive Numerário Detail & Simulator Drawer */}
      <NumerarioDetailDrawer
        line={selectedLine}
        currentOverride={selectedLine ? numerarioOverrides[selectedLine.id] : undefined}
        onClose={() => setSelectedLineId(null)}
        onSaveOverride={onSaveNumerarioOverride}
        onSelectProcess={onSelectProcess}
      />
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
} from 'recharts';
import { Download, FileText } from 'lucide-react';
import type { FupItemRow, ShipmentProcessRow } from '../types/comex';
import { buildCashFlowData } from '../utils/comexEngine';
import { formatCurrency, formatDateBr } from '../utils/sapParser';
import {
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
  formatAxisBrl,
  formatCompactBrl,
} from '../utils/chartFormatters';
import { exportCashFlowExcel, exportCashFlowPdf } from '../utils/exportReports';
import { StatusBadge, getFinancialStatusTone } from './StatusBadge';
import { useI18n } from '../i18n/I18nContext';
import {
  translateFinancialCategory,
  translateFinancialSource,
  translateFinancialStatus,
} from '../i18n/helpers';

interface PaymentsCashFlowProps {
  items: FupItemRow[];
  processes: ShipmentProcessRow[];
}

export const PaymentsCashFlow: React.FC<PaymentsCashFlowProps> = ({ items, processes }) => {
  const { lang, tr, fmt } = useI18n();
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAGO' | 'A VENCER' | 'VENCIDA' | 'PROJETADO'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'MIRO/FI' | 'LOGISTICS' | 'CUSTOMS/TAXES'>('ALL');

  const allEntries = useMemo(() => buildCashFlowData(items, processes), [items, processes]);

  const filteredEntries = useMemo(
    () =>
      allEntries.filter(
        (e) =>
          (statusFilter === 'ALL' || e.status === statusFilter) &&
          (sourceFilter === 'ALL' || e.source === sourceFilter)
      ),
    [allEntries, statusFilter, sourceFilter]
  );

  const totals = useMemo(() => {
    const paid = allEntries.filter((e) => e.status === 'PAGO').reduce((s, e) => s + e.amountBrl, 0);
    const overdue = allEntries.filter((e) => e.status === 'VENCIDA').reduce((s, e) => s + e.amountBrl, 0);
    const upcoming = allEntries
      .filter((e) => e.status === 'A VENCER' || e.status === 'PROJETADO')
      .reduce((s, e) => s + e.amountBrl, 0);
    const totalLanded = processes.reduce((s, p) => s + p.brlFob + p.totalCostBrl + p.impostos, 0);
    return { paid, overdue, upcoming, totalLanded };
  }, [allEntries, processes]);

  const timelineChartData = useMemo(() => {
    const monthMap = new Map<
      string,
      { month: string; paid: number; open: number; overdue: number; total: number }
    >();
    for (const entry of allEntries) {
      const monthKey = entry.dueDate ? entry.dueDate.slice(0, 7) : 'TBD';
      const bucket = monthMap.get(monthKey) || {
        month: monthKey,
        paid: 0,
        open: 0,
        overdue: 0,
        total: 0,
      };
      if (entry.status === 'PAGO') bucket.paid += Math.round(entry.amountBrl);
      else if (entry.status === 'VENCIDA') bucket.overdue += Math.round(entry.amountBrl);
      else bucket.open += Math.round(entry.amountBrl);
      bucket.total = bucket.paid + bucket.open + bucket.overdue;
      monthMap.set(monthKey, bucket);
    }
    return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [allEntries]);

  return (
    <div className="space-y-6">
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{tr.payments.settledTitle}</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
            {formatCurrency(totals.paid, 'BRL')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {tr.payments.settledSub}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{tr.payments.upcomingTitle}</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-300">
            {formatCurrency(totals.upcoming, 'BRL')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {tr.payments.upcomingSub}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{tr.payments.overdueTitle}</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400">
            {formatCurrency(totals.overdue, 'BRL')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {tr.payments.overdueSub}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{tr.payments.landedTitle}</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(totals.totalLanded, 'BRL')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {fmt(tr.payments.landedSub, { count: processes.length })}
          </div>
        </div>
      </div>

      {/* Cash Flow Timeline Chart & Actions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {tr.payments.chartTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tr.payments.chartSubtitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportCashFlowExcel(filteredEntries)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Download className="w-3.5 h-3.5" />
              {tr.payments.exportExcel}
            </button>
            <button
              type="button"
              onClick={() => exportCashFlowPdf(filteredEntries)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <FileText className="w-3.5 h-3.5" />
              {tr.payments.exportPdf}
            </button>
          </div>
        </div>

        <div className="h-[255px] text-slate-700 dark:text-slate-200">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={timelineChartData} margin={{ top: 24, right: 16, left: 6, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={formatAxisBrl}
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
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="paid" name={tr.payments.seriesPaid} stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="open" name={tr.payments.seriesOpen} stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
              <Bar dataKey="overdue" name={tr.payments.seriesOverdue} stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="none"
                dot={false}
                activeDot={false}
                legendType="none"
                tooltipType="none"
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="total"
                  position="top"
                  offset={8}
                  fill="currentColor"
                  fontSize={10.5}
                  fontWeight={600}
                  formatter={(val) => formatCompactBrl(Number(val) || 0)}
                />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Shipment Landed Cost Breakdown Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {tr.payments.breakdownTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {tr.payments.breakdownSubtitle}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                <th className="py-2.5 px-3 font-medium">{tr.payments.colRefMfx}</th>
                <th className="py-2.5 px-3 font-medium">{tr.payments.colExporter}</th>
                <th className="py-2.5 px-3 font-medium text-right">{tr.payments.colFobOrig}</th>
                <th className="py-2.5 px-3 font-medium text-right">{tr.payments.colFobBrl}</th>
                <th className="py-2.5 px-3 font-medium text-right">{tr.payments.colFreightBrl}</th>
                <th className="py-2.5 px-3 font-medium text-right">{tr.payments.colWarehouse}</th>
                <th className="py-2.5 px-3 font-medium text-right">{tr.payments.colServices}</th>
                <th className="py-2.5 px-3 font-medium text-right">{tr.payments.colTaxesBrl}</th>
                <th className="py-2.5 px-3 font-medium text-right">{tr.payments.colTotalLanded}</th>
                <th className="py-2.5 px-3 font-medium text-right">{tr.payments.colLogFob}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 whitespace-nowrap">
              {processes.map((p) => {
                const services = p.brokerFee + p.trucking + p.liFee + p.demurrageTotal + p.afrmm;
                const landed = p.brlFob + p.totalCostBrl + p.impostos;
                return (
                  <tr key={p.ref} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-semibold text-cyan-700 dark:text-cyan-300">{p.ref}</td>
                    <td className="py-2.5 px-3">{p.exporter}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatCurrency(p.invoiceValue, p.currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatCurrency(p.brlFob, 'BRL')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatCurrency(p.freightTotal, 'BRL')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatCurrency(p.warehouse, 'BRL')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatCurrency(services, 'BRL')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatCurrency(p.impostos, 'BRL')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(landed, 'BRL')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{p.pctCostFob}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MIRO / FI & Logistics Cash Flow Ledger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {tr.payments.ledgerTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tr.payments.ledgerSubtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={tr.payments.filterSourceAria}
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="ALL">{tr.payments.allSources}</option>
              <option value="MIRO/FI">{tr.enums.financialSource.MIRO_FI}</option>
              <option value="LOGISTICS">{tr.enums.financialSource.LOGISTICS}</option>
              <option value="CUSTOMS/TAXES">{tr.enums.financialSource.CUSTOMS_TAXES}</option>
            </select>
            <select
              aria-label={tr.payments.filterStatusAria}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="ALL">{tr.common.allStatuses}</option>
              <option value="PAGO">{tr.enums.financialStatus.PAGO}</option>
              <option value="A VENCER">{tr.enums.financialStatus.A_VENCER}</option>
              <option value="VENCIDA">{tr.enums.financialStatus.VENCIDA}</option>
              <option value="PROJETADO">{tr.enums.financialStatus.PROJETADO}</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                <th className="py-2.5 px-3 font-medium">{tr.payments.colSource}</th>
                <th className="py-2.5 px-3 font-medium">{tr.payments.colPoRef}</th>
                <th className="py-2.5 px-3 font-medium">{tr.payments.colPartner}</th>
                <th className="py-2.5 px-3 font-medium">{tr.payments.colDoc}</th>
                <th className="py-2.5 px-3 font-medium">{tr.payments.colCategory}</th>
                <th className="py-2.5 px-3 font-medium">{tr.payments.colDueDate}</th>
                <th className="py-2.5 px-3 font-medium">{tr.payments.colClearing}</th>
                <th className="py-2.5 px-3 font-medium text-right">{tr.payments.colOrigAmount}</th>
                <th className="py-2.5 px-3 font-medium text-right">{tr.payments.colBrlValue}</th>
                <th className="py-2.5 px-3 font-medium">{tr.payments.colStatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 whitespace-nowrap">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {translateFinancialSource(entry.source, lang)}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">{entry.reference}</div>
                    {entry.processRef !== '-' && (
                      <div className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400">{entry.processRef}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3">{entry.partner}</td>
                  <td className="py-2.5 px-3 font-mono">{entry.documentNumber}</td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                    {translateFinancialCategory(entry.category, lang)}
                  </td>
                  <td className="py-2.5 px-3 font-mono">{formatDateBr(entry.dueDate)}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-slate-400">
                    {entry.clearingDoc ? `${entry.clearingDoc} (${formatDateBr(entry.clearingDate)})` : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {formatCurrency(entry.amount, entry.currency)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(entry.amountBrl, 'BRL')}
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusBadge
                      label={translateFinancialStatus(entry.status, lang)}
                      tone={getFinancialStatusTone(entry.status)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

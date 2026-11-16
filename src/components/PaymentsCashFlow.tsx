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

interface PaymentsCashFlowProps {
  items: FupItemRow[];
  processes: ShipmentProcessRow[];
}

export const PaymentsCashFlow: React.FC<PaymentsCashFlowProps> = ({ items, processes }) => {
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
          <div className="text-xs text-slate-500 dark:text-slate-400">Settled / Paid (Compensado FI)</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
            {formatCurrency(totals.paid, 'BRL')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            AUGBL cleared invoices & delivered freights
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Upcoming / Projected Outflows</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-300">
            {formatCurrency(totals.upcoming, 'BRL')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            MIRO A Vencer, Numerário & Open PO forecasts
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Overdue MIRO Invoices (Vencidas)</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400">
            {formatCurrency(totals.overdue, 'BRL')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Requires immediate alignment with Finance (F110)
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Shipment Landed Cost</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(totals.totalLanded, 'BRL')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            FOB + Logistics + Port + Taxes ({processes.length} processes)
          </div>
        </div>
      </div>

      {/* Cash Flow Timeline Chart & Actions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Monthly Cash Flow Forecast Timeline (BRL)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Settled vs. Upcoming vs. Overdue disbursements across MIRO/FI, Logistics, and Customs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportCashFlowExcel(filteredEntries)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Download className="w-3.5 h-3.5" />
              Export Excel
            </button>
            <button
              type="button"
              onClick={() => exportCashFlowPdf(filteredEntries)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <FileText className="w-3.5 h-3.5" />
              Export Finance PDF
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
              <Bar dataKey="paid" name="Settled (Pago)" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="open" name="Upcoming / Projected" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
              <Bar dataKey="overdue" name="Overdue (Vencida)" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
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
            Shipment Cost Breakdown per MFX Process
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            FOB BRL, International Freight, Port Warehouse, Capatazia/Broker/Trucking, Customs Taxes & Cost %
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                <th className="py-2.5 px-3 font-medium">Ref MFX</th>
                <th className="py-2.5 px-3 font-medium">Supplier / Exporter</th>
                <th className="py-2.5 px-3 font-medium text-right">FOB (Orig)</th>
                <th className="py-2.5 px-3 font-medium text-right">FOB (BRL)</th>
                <th className="py-2.5 px-3 font-medium text-right">Freight (BRL)</th>
                <th className="py-2.5 px-3 font-medium text-right">Warehouse</th>
                <th className="py-2.5 px-3 font-medium text-right">Services & Extras</th>
                <th className="py-2.5 px-3 font-medium text-right">Taxes (BRL)</th>
                <th className="py-2.5 px-3 font-medium text-right">Total Landed (BRL)</th>
                <th className="py-2.5 px-3 font-medium text-right">Log % FOB</th>
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
              SAP MIRO / FI & Customs Cash Flow Schedule
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Parsed directly from FATURAS_JSON, FINANCEIRO_JSON, and customs/logistics disbursements
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter cash flow by source"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="ALL">All Sources</option>
              <option value="MIRO/FI">SAP MIRO / FI</option>
              <option value="LOGISTICS">Logistics & Port</option>
              <option value="CUSTOMS/TAXES">Customs Taxes</option>
            </select>
            <select
              aria-label="Filter cash flow by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAGO">PAGO</option>
              <option value="A VENCER">A VENCER</option>
              <option value="VENCIDA">VENCIDA</option>
              <option value="PROJETADO">PROJETADO</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                <th className="py-2.5 px-3 font-medium">Source</th>
                <th className="py-2.5 px-3 font-medium">PO / Ref</th>
                <th className="py-2.5 px-3 font-medium">Partner</th>
                <th className="py-2.5 px-3 font-medium">Document (MIRO/FI)</th>
                <th className="py-2.5 px-3 font-medium">Category</th>
                <th className="py-2.5 px-3 font-medium">Due Date</th>
                <th className="py-2.5 px-3 font-medium">Clearing (AUGBL)</th>
                <th className="py-2.5 px-3 font-medium text-right">Orig Amount</th>
                <th className="py-2.5 px-3 font-medium text-right">BRL Value</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 whitespace-nowrap">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {entry.source}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">{entry.reference}</div>
                    {entry.processRef !== '-' && (
                      <div className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400">{entry.processRef}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3">{entry.partner}</td>
                  <td className="py-2.5 px-3 font-mono">{entry.documentNumber}</td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{entry.category}</td>
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
                    <StatusBadge label={entry.status} tone={getFinancialStatusTone(entry.status)} />
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

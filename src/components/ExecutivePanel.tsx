import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { AlertTriangle, Package, Ship, ShieldCheck, Clock } from 'lucide-react';
import type { FupItemRow, ShipmentProcessRow } from '../types/comex';
import { computeExecutiveKpis, isDrawbackExpectedNcm } from '../utils/comexEngine';
import { formatCurrency, formatDateBr, formatNumber } from '../utils/sapParser';
import { StatusBadge, getDeliveryStatusTone } from './StatusBadge';

interface ExecutivePanelProps {
  items: FupItemRow[];
  processes: ShipmentProcessRow[];
  onSelectProcess: (ref: string) => void;
  onFilterByNcm: (ncm: string) => void;
}

export const ExecutivePanel: React.FC<ExecutivePanelProps> = ({
  items,
  processes,
  onSelectProcess,
  onFilterByNcm,
}) => {
  const kpis = useMemo(() => computeExecutiveKpis(items, processes), [items, processes]);

  const openPoItems = useMemo(
    () =>
      items
        .filter((i) => i.LOEKZ !== 'L' && i.STATUS_PRAZO_ENTREGA !== 'ITEM EXCLUIDO' && i.QUANTIDADE_PENDENTE > 0)
        .sort((a, b) => b.DIAS_ATRASO_ENTREGA - a.DIAS_ATRASO_ENTREGA),
    [items]
  );

  const openPoChartData = useMemo(
    () =>
      openPoItems.slice(0, 8).map((i) => ({
        name: `${i.PEDIDO}`,
        supplier: i.NOME_FORNECEDOR.split(' ')[0],
        pending: i.QUANTIDADE_PENDENTE,
        delayed: i.DIAS_ATRASO_ENTREGA > 0,
      })),
    [openPoItems]
  );

  const drawbackTotal = kpis.drawbackFobBrl + kpis.fullTaxFobBrl;
  const drawbackPct = drawbackTotal > 0 ? Math.round((kpis.drawbackFobBrl / drawbackTotal) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Active POs & Open Items</span>
            <Package className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {kpis.activePoCount} POs
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {kpis.openItemCount} open lines
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Open Qty:{' '}
              <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {formatNumber(kpis.totalOpenQty, 0)}
              </strong>
            </span>
            <span className="font-mono tabular-nums text-cyan-700 dark:text-cyan-300 font-medium">
              {Object.entries(kpis.openValueByCurrency)
                .map(([curr, val]) => formatCurrency(val, curr))
                .join(' · ') || 'USD 0,00'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Delivery & Schedule Health</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {kpis.onTimeRate}%
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">On-Time Rate</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
              {kpis.onTimeCount} On-Time · {kpis.completedCount} Done
            </span>
            <span className="text-rose-600 dark:text-rose-400 font-mono tabular-nums">
              {kpis.delayedCount} Delayed (avg {kpis.avgDelayDays}d)
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Active Import Processes</span>
            <Ship className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {kpis.processCounts.total}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">MFX Refs (25/26)</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono tabular-nums">
            <span className="text-cyan-700 dark:text-cyan-300">
              {kpis.processCounts.inTransit} Transit
            </span>
            <span className="text-amber-700 dark:text-amber-300">
              {kpis.processCounts.awaitingClearance + kpis.processCounts.stoppedDrawback} Clearance
            </span>
            <span className="text-emerald-700 dark:text-emerald-300">
              {kpis.processCounts.delivered} Delivered
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Drawback & Tax Efficiency</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {drawbackPct}%
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Under Ato Concessório</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              DBK: {formatCurrency(kpis.drawbackFobBrl, 'BRL')}
            </span>
            <span className="text-amber-700 dark:text-amber-300 font-mono tabular-nums">
              Taxes: {formatCurrency(kpis.totalTaxesBrl, 'BRL')}
            </span>
          </div>
        </div>
      </div>

      {/* Main Split: Open Quantities Monitor + Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Open Quantity & Pending POs Monitor
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                PO lines with QUANTIDADE_PENDENTE &gt; 0 sorted by delivery delay severity
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {openPoItems.length} active lines
            </span>
          </div>

          {openPoItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No pending PO quantities match the active filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                    <th className="py-2.5 px-2 font-medium">PO / Ref MFX</th>
                    <th className="py-2.5 px-2 font-medium">Material & Description</th>
                    <th className="py-2.5 px-2 font-medium">NCM</th>
                    <th className="py-2.5 px-2 font-medium">PEP Project</th>
                    <th className="py-2.5 px-2 font-medium">Supplier</th>
                    <th className="py-2.5 px-2 font-medium text-right">Open Qty</th>
                    <th className="py-2.5 px-2 font-medium">EINDT / Delay</th>
                    <th className="py-2.5 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {openPoItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {item.PEDIDO}
                        </div>
                        {item.ULTIMO_PROCESSO_IMPORTACAO ? (
                          <button
                            type="button"
                            onClick={() => onSelectProcess(item.ULTIMO_PROCESSO_IMPORTACAO)}
                            className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 hover:underline"
                          >
                            {item.ULTIMO_PROCESSO_IMPORTACAO}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Sem embarque</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 max-w-[140px]">
                        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {item.MATERIAL}
                        </div>
                        <div className="truncate font-medium text-slate-900 dark:text-slate-100" title={item.DESCRICAO_MATERIAL}>
                          {item.DESCRICAO_MATERIAL}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 font-mono whitespace-nowrap">
                        <span className="text-slate-700 dark:text-slate-300">{item.FUP_NCMS}</span>
                        {isDrawbackExpectedNcm(item.FUP_NCMS) && !item.FUP_ATO_CONCESSORIO && (
                          <span
                            title="NCM eligible for Drawback but missing Ato Concessório in SAP"
                            className="ml-1 inline-flex items-center text-amber-600 dark:text-amber-400"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 max-w-[105px] truncate text-slate-700 dark:text-slate-300" title={item.DESCRICAO_ELEMENTO_PEP}>
                        {item.DESCRICAO_ELEMENTO_PEP || '-'}
                      </td>
                      <td className="py-2.5 px-2 max-w-[105px] truncate text-slate-700 dark:text-slate-300" title={item.NOME_FORNECEDOR}>
                        {item.NOME_FORNECEDOR}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums whitespace-nowrap font-semibold text-slate-900 dark:text-white">
                        {formatNumber(item.QUANTIDADE_PENDENTE, 0)} {item.UNIDADE}
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap font-mono tabular-nums">
                        <div className="text-slate-700 dark:text-slate-300">
                          {formatDateBr(item.DATA_ENTREGA_PREVISTA)}
                        </div>
                        {item.DIAS_ATRASO_ENTREGA > 0 && (
                          <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                            +{item.DIAS_ATRASO_ENTREGA}d atraso
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <StatusBadge
                          label={item.STATUS_PRAZO_ENTREGA}
                          tone={getDeliveryStatusTone(item.STATUS_PRAZO_ENTREGA)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Open Qty by PO Chart */}
        <div className="xl:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Pending Volume by PO
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Rose bars = past EINDT
            </p>
          </div>
          <div className="flex-1 min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={openPoChartData} margin={{ top: 8, right: 6, left: -18, bottom: 18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#f8fafc',
                  }}
                />
                <Bar dataKey="pending" name="Open Qty" radius={[4, 4, 0, 0]}>
                  {openPoChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.delayed ? '#f43f5e' : '#06b6d4'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Split: NCM & Drawback AC Control + Project PEP Progress Tracker */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* NCM & Ato Concessorio Control */}
        <div className="xl:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                NCM & Drawback Ato Concessório Control
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any NCM row to filter · Alerts flag eligible NCMs missing AC in SAP
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2 px-3 font-medium">NCM</th>
                  <th className="py-2 px-3 font-medium text-right">Items</th>
                  <th className="py-2 px-3 font-medium text-right">Open Qty</th>
                  <th className="py-2 px-3 font-medium text-right">Order Value</th>
                  <th className="py-2 px-3 font-medium">Ato Concessório / Alert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {kpis.ncmSummary.map((row) => (
                  <tr
                    key={row.ncm}
                    onClick={() => onFilterByNcm(row.ncm)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {row.ncm}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {row.itemCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                      {formatNumber(row.openQty, 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                      {formatCurrency(row.totalValueUsdOrOrig, row.currency)}
                    </td>
                    <td className="py-2.5 px-3">
                      {row.acNumbers.length > 0 ? (
                        <span className="font-mono text-emerald-700 dark:text-emerald-300">
                          AC {row.acNumbers.join(', ')}
                        </span>
                      ) : row.missingAcAlert ? (
                        <StatusBadge label="MISSING AC IN SAP" tone="amber" />
                      ) : (
                        <span className="text-slate-400">Rec. Integral</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Project / Elemento PEP Progress Tracker */}
        <div className="xl:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Project / Elemento PEP Progress Tracker
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Received in Plant 0003 vs. In-Transit (MFX Ref) vs. Pending Shipment
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
              <span className="flex items-center gap-1 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block shrink-0" /> Plant 0003
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block shrink-0" /> In Transit
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-700 inline-block shrink-0" /> Open PO
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {kpis.pepProgress.map((pep, idx) => (
              <div key={`${pep.pepCode}::${pep.pepDescription}::${idx}`} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate pr-3">
                    {pep.pepDescription}{' '}
                    <span className="font-mono text-[11px] text-slate-400">({pep.pepCode})</span>
                  </div>
                  <div className="font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {pep.pctReceived}% rec · {formatCurrency(pep.totalValueBrl, 'BRL')}
                  </div>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                  <div
                    style={{ width: `${pep.pctReceived}%` }}
                    className="bg-emerald-500 h-full transition-all"
                    title={`Received: ${formatNumber(pep.receivedQty, 0)}`}
                  />
                  <div
                    style={{ width: `${pep.pctInTransit}%` }}
                    className="bg-cyan-500 h-full transition-all"
                    title={`In Transit: ${formatNumber(pep.inTransitQty, 0)}`}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  <span>Ordered: {formatNumber(pep.totalOrdered, 0)}</span>
                  <span>
                    Rec: {formatNumber(pep.receivedQty, 0)} · Transit: {formatNumber(pep.inTransitQty, 0)} · Pending:{' '}
                    {formatNumber(pep.pendingShipmentQty, 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

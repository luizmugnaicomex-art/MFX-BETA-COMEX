import React, { useEffect, useMemo, useState } from 'react';
import { Download, Eye, EyeOff, X, Save } from 'lucide-react';
import type {
  ShipmentOperationalStatus,
  ShipmentOverrides,
  ShipmentProcessRow,
} from '../types/comex';
import { formatCurrency, formatNumber } from '../utils/sapParser';
import { exportShipmentsWorkbook } from '../utils/exportReports';
import { StatusBadge, getChannelTone, getShipmentStatusTone } from './StatusBadge';

type GroupKey =
  | 'IDENTIFICATION'
  | 'PROCESSO'
  | 'PRE_ALERT'
  | 'EMBARQUE'
  | 'DESEMBARACO'
  | 'ESTADIA'
  | 'CUSTOS';

const GROUP_META: Array<{ key: GroupKey; label: string; headerBg: string }> = [
  { key: 'IDENTIFICATION', label: 'IDENTIFICATION', headerBg: 'bg-slate-800 text-slate-100' },
  { key: 'PROCESSO', label: 'PROCESSO (Agente de Carga)', headerBg: 'bg-cyan-900 text-cyan-100' },
  { key: 'PRE_ALERT', label: 'PRE ALERT + ORIGINAIS (Despachante)', headerBg: 'bg-indigo-900 text-indigo-100' },
  { key: 'EMBARQUE', label: 'EMBARQUE (Agente de Carga)', headerBg: 'bg-sky-900 text-sky-100' },
  { key: 'DESEMBARACO', label: 'REGISTRO | DESEMBARAÇO (Despachante)', headerBg: 'bg-amber-900 text-amber-100' },
  { key: 'ESTADIA', label: 'ESTADIA (Transp+Arm) & TIME', headerBg: 'bg-rose-900 text-rose-100' },
  { key: 'CUSTOS', label: 'CUSTOS | PAGAMENTOS & STATUS', headerBg: 'bg-emerald-900 text-emerald-100' },
];

const STATUS_OPTIONS: ShipmentOperationalStatus[] = [
  'AG. PRONTIDAO DA CARGA',
  'EM TRÂNSITO',
  'AG. DESEMBARAÇO',
  'PARADO AG. DRAWBACK',
  'ENTREGUE',
];

interface ShipmentsWorkbenchProps {
  processes: ShipmentProcessRow[];
  overrides: Record<string, ShipmentOverrides>;
  onSaveOverride: (ref: string, next: ShipmentOverrides) => void;
  selectedProcessRef: string | null;
  onSelectProcessRef: (ref: string | null) => void;
}

export const ShipmentsWorkbench: React.FC<ShipmentsWorkbenchProps> = ({
  processes,
  overrides,
  onSaveOverride,
  selectedProcessRef,
  onSelectProcessRef,
}) => {
  const [visibleGroups, setVisibleGroups] = useState<Record<GroupKey, boolean>>({
    IDENTIFICATION: true,
    PROCESSO: true,
    PRE_ALERT: true,
    EMBARQUE: true,
    DESEMBARACO: true,
    ESTADIA: true,
    CUSTOS: true,
  });

  const activeProcess = useMemo(
    () => processes.find((p) => p.ref === selectedProcessRef) || null,
    [processes, selectedProcessRef]
  );

  const [draft, setDraft] = useState<ShipmentOverrides>({});

  useEffect(() => {
    if (!activeProcess) return;
    const existing = overrides[activeProcess.ref] || {};
    setDraft({
      resp: existing.resp ?? activeProcess.resp,
      pi: existing.pi ?? activeProcess.pi,
      brokerFee: existing.brokerFee ?? activeProcess.brokerFee,
      truckingCost: existing.truckingCost ?? activeProcess.trucking,
      liFee: existing.liFee ?? activeProcess.liFee,
      demurrageCost: existing.demurrageCost ?? activeProcess.demurrageTotal,
      devCtnrDate: existing.devCtnrDate ?? (activeProcess.devCtnr === '-' ? '' : activeProcess.devCtnr),
      status: existing.status ?? activeProcess.status,
      trackingNum: existing.trackingNum ?? (activeProcess.trackingNum === '-' ? '' : activeProcess.trackingNum),
      numerarioDate: existing.numerarioDate ?? (activeProcess.numerario === '-' ? '' : activeProcess.numerario),
      valorAdt: existing.valorAdt ?? activeProcess.valorAdt,
    });
  }, [activeProcess, overrides]);

  useEffect(() => {
    if (!activeProcess) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSelectProcessRef(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeProcess, onSelectProcessRef]);

  const openProcessDrawer = (proc: ShipmentProcessRow) => {
    onSelectProcessRef(proc.ref);
  };

  const toggleGroup = (key: GroupKey) => {
    if (key === 'IDENTIFICATION') return; // Keep Ref # anchored
    setVisibleGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveDrawer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProcess) return;
    onSaveOverride(activeProcess.ref, draft);
    onSelectProcessRef(null);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar: Column Group Toggles + Export Excel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">
            Stage Groups:
          </span>
          {GROUP_META.map((g) => {
            const active = visibleGroups[g.key];
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => toggleGroup(g.key)}
                disabled={g.key === 'IDENTIFICATION'}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-cyan-500/15 dark:text-cyan-200 dark:border-cyan-500/35'
                    : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-950 dark:text-slate-500 dark:border-slate-800'
                } ${g.key === 'IDENTIFICATION' ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
              >
                {active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {g.key}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => exportShipmentsWorkbook(processes)}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Export SHIPMENTS COMEX.xlsx
        </button>
      </div>

      {/* Exact Multi-Header Replicated Workbench Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {processes.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No MFX Import Processes match the active filters.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[680px]">
            <table className="w-max min-w-full border-collapse text-[11px]">
              <thead className="sticky top-0 z-20">
                {/* Super-Header Row */}
                <tr>
                  {visibleGroups.IDENTIFICATION && (
                    <th colSpan={7} className="py-1.5 px-2 text-left font-semibold bg-slate-800 text-slate-100 border-r border-slate-700">
                      IDENTIFICATION
                    </th>
                  )}
                  {visibleGroups.PROCESSO && (
                    <th colSpan={16} className="py-1.5 px-2 text-left font-semibold bg-cyan-900 text-cyan-100 border-r border-cyan-800">
                      PROCESSO (Agente de Carga)
                    </th>
                  )}
                  {visibleGroups.PRE_ALERT && (
                    <th colSpan={14} className="py-1.5 px-2 text-left font-semibold bg-indigo-900 text-indigo-100 border-r border-indigo-800">
                      PRE ALERT + ORIGINAIS (Despachante)
                    </th>
                  )}
                  {visibleGroups.EMBARQUE && (
                    <th colSpan={8} className="py-1.5 px-2 text-left font-semibold bg-sky-900 text-sky-100 border-r border-sky-800">
                      EMBARQUE (Agente de Carga)
                    </th>
                  )}
                  {visibleGroups.DESEMBARACO && (
                    <th colSpan={20} className="py-1.5 px-2 text-left font-semibold bg-amber-900 text-amber-100 border-r border-amber-800">
                      REGISTRO | DESEMBARAÇO (Despachante)
                    </th>
                  )}
                  {visibleGroups.ESTADIA && (
                    <th colSpan={7} className="py-1.5 px-2 text-left font-semibold bg-rose-900 text-rose-100 border-r border-rose-800">
                      ESTADIA (Transp+Arm) & TIME
                    </th>
                  )}
                  {visibleGroups.CUSTOS && (
                    <th colSpan={13} className="py-1.5 px-2 text-left font-semibold bg-emerald-900 text-emerald-100">
                      CUSTOS | PAGAMENTOS (Importação + Total) & STATUS
                    </th>
                  )}
                </tr>

                {/* Sub-Header Column Row */}
                <tr className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                  {visibleGroups.IDENTIFICATION && (
                    <>
                      <th className="py-2 px-2.5 font-medium">RESP</th>
                      <th className="py-2 px-2.5 font-medium">Ref #</th>
                      <th className="py-2 px-2.5 font-medium">Exporter</th>
                      <th className="py-2 px-2.5 font-medium">Linha</th>
                      <th className="py-2 px-2.5 font-medium">PI</th>
                      <th className="py-2 px-2.5 font-medium">PO</th>
                      <th className="py-2 px-2.5 font-medium border-r border-slate-300 dark:border-slate-700">AC</th>
                    </>
                  )}
                  {visibleGroups.PROCESSO && (
                    <>
                      <th className="py-2 px-2.5 font-medium">Agente Carga</th>
                      <th className="py-2 px-2.5 font-medium text-right">Ptax</th>
                      <th className="py-2 px-2.5 font-medium text-right">Freight Cost</th>
                      <th className="py-2 px-2.5 font-medium text-right">BRL Frete</th>
                      <th className="py-2 px-2.5 font-medium">BL/AWB</th>
                      <th className="py-2 px-2.5 font-medium">Master</th>
                      <th className="py-2 px-2.5 font-medium">Modal</th>
                      <th className="py-2 px-2.5 font-medium">Incoterm</th>
                      <th className="py-2 px-2.5 font-medium">CNTR</th>
                      <th className="py-2 px-2.5 font-medium">SEAL</th>
                      <th className="py-2 px-2.5 font-medium text-right">20&apos;</th>
                      <th className="py-2 px-2.5 font-medium text-right">40&apos;</th>
                      <th className="py-2 px-2.5 font-medium">Inv/Pck</th>
                      <th className="py-2 px-2.5 font-medium">Orig. BL</th>
                      <th className="py-2 px-2.5 font-medium">Reg Trib</th>
                      <th className="py-2 px-2.5 font-medium border-r border-slate-300 dark:border-slate-700">AC Sub</th>
                    </>
                  )}
                  {visibleGroups.PRE_ALERT && (
                    <>
                      <th className="py-2 px-2.5 font-medium">IE</th>
                      <th className="py-2 px-2.5 font-medium">Broker</th>
                      <th className="py-2 px-2.5 font-medium text-right">Valor</th>
                      <th className="py-2 px-2.5 font-medium">Pre-Alert</th>
                      <th className="py-2 px-2.5 font-medium">DI draft</th>
                      <th className="py-2 px-2.5 font-medium text-right">Ptax</th>
                      <th className="py-2 px-2.5 font-medium text-right">Invoice Value</th>
                      <th className="py-2 px-2.5 font-medium">Moeda</th>
                      <th className="py-2 px-2.5 font-medium">MIRO</th>
                      <th className="py-2 px-2.5 font-medium text-right">BRL Invoice</th>
                      <th className="py-2 px-2.5 font-medium">Paid</th>
                      <th className="py-2 px-2.5 font-medium">Tracking #</th>
                      <th className="py-2 px-2.5 font-medium">Doc Broker</th>
                      <th className="py-2 px-2.5 font-medium border-r border-slate-300 dark:border-slate-700">BL Broker</th>
                    </>
                  )}
                  {visibleGroups.EMBARQUE && (
                    <>
                      <th className="py-2 px-2.5 font-medium">From</th>
                      <th className="py-2 px-2.5 font-medium">ETD</th>
                      <th className="py-2 px-2.5 font-medium">Transshipment</th>
                      <th className="py-2 px-2.5 font-medium">Port</th>
                      <th className="py-2 px-2.5 font-medium">Trans. ETA</th>
                      <th className="py-2 px-2.5 font-medium">Trans. ETD</th>
                      <th className="py-2 px-2.5 font-medium">ETA</th>
                      <th className="py-2 px-2.5 font-medium border-r border-slate-300 dark:border-slate-700">ETA Factory</th>
                    </>
                  )}
                  {visibleGroups.DESEMBARACO && (
                    <>
                      <th className="py-2 px-2.5 font-medium">Berthing</th>
                      <th className="py-2 px-2.5 font-medium">Terminal</th>
                      <th className="py-2 px-2.5 font-medium">Presença</th>
                      <th className="py-2 px-2.5 font-medium">Numerario</th>
                      <th className="py-2 px-2.5 font-medium text-right">Valor ADT</th>
                      <th className="py-2 px-2.5 font-medium">Registro</th>
                      <th className="py-2 px-2.5 font-medium">DI #</th>
                      <th className="py-2 px-2.5 font-medium text-right">Ptax</th>
                      <th className="py-2 px-2.5 font-medium text-right">Impostos</th>
                      <th className="py-2 px-2.5 font-medium text-right">AFRMM</th>
                      <th className="py-2 px-2.5 font-medium text-right">ECOTAX</th>
                      <th className="py-2 px-2.5 font-medium">Canal</th>
                      <th className="py-2 px-2.5 font-medium">DES | CI</th>
                      <th className="py-2 px-2.5 font-medium">Espelho</th>
                      <th className="py-2 px-2.5 font-medium">Minuta</th>
                      <th className="py-2 px-2.5 font-medium">NF</th>
                      <th className="py-2 px-2.5 font-medium">NF#</th>
                      <th className="py-2 px-2.5 font-medium">Transportadora</th>
                      <th className="py-2 px-2.5 font-medium text-right">Frete</th>
                      <th className="py-2 px-2.5 font-medium border-r border-slate-300 dark:border-slate-700">Recebimento</th>
                    </>
                  )}
                  {visibleGroups.ESTADIA && (
                    <>
                      <th className="py-2 px-2.5 font-medium text-right">Days</th>
                      <th className="py-2 px-2.5 font-medium text-right">Periodos</th>
                      <th className="py-2 px-2.5 font-medium text-right">Armazenagem</th>
                      <th className="py-2 px-2.5 font-medium">Dev. CTNR</th>
                      <th className="py-2 px-2.5 font-medium text-right">Demurrage</th>
                      <th className="py-2 px-2.5 font-medium text-right">T.T</th>
                      <th className="py-2 px-2.5 font-medium text-right border-r border-slate-300 dark:border-slate-700">Lead</th>
                    </>
                  )}
                  {visibleGroups.CUSTOS && (
                    <>
                      <th className="py-2 px-2.5 font-medium text-right">Warehouse</th>
                      <th className="py-2 px-2.5 font-medium text-right">Trucking</th>
                      <th className="py-2 px-2.5 font-medium text-right">Broker</th>
                      <th className="py-2 px-2.5 font-medium text-right">Freight</th>
                      <th className="py-2 px-2.5 font-medium text-right">LI</th>
                      <th className="py-2 px-2.5 font-medium text-right">Demurrage</th>
                      <th className="py-2 px-2.5 font-medium text-right">Cost</th>
                      <th className="py-2 px-2.5 font-medium text-right">R$ CIF</th>
                      <th className="py-2 px-2.5 font-medium text-right">R$ FOB</th>
                      <th className="py-2 px-2.5 font-medium text-right">USD FOB</th>
                      <th className="py-2 px-2.5 font-medium text-right">% Cost/CIF</th>
                      <th className="py-2 px-2.5 font-medium text-right">% Cost/FOB</th>
                      <th className="py-2 px-2.5 font-medium">STATUS</th>
                    </>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 whitespace-nowrap">
                {processes.map((p) => (
                  <tr
                    key={p.ref}
                    onClick={() => openProcessDrawer(p)}
                    className="cursor-pointer hover:bg-cyan-50/70 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    {visibleGroups.IDENTIFICATION && (
                      <>
                        <td className="py-2 px-2.5 font-medium">{p.resp}</td>
                        <td className="py-2 px-2.5 font-mono font-semibold text-cyan-700 dark:text-cyan-300">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openProcessDrawer(p);
                            }}
                            className="hover:underline"
                          >
                            {p.ref}
                          </button>
                        </td>
                        <td className="py-2 px-2.5">{p.exporter}</td>
                        <td className="py-2 px-2.5">{p.linha}</td>
                        <td className="py-2 px-2.5 font-mono">{p.pi}</td>
                        <td className="py-2 px-2.5 font-mono">{p.poList}</td>
                        <td className="py-2 px-2.5 font-mono border-r border-slate-200 dark:border-slate-800">{p.ac}</td>
                      </>
                    )}
                    {visibleGroups.PROCESSO && (
                      <>
                        <td className="py-2 px-2.5">{p.agenteCarga}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatNumber(p.ptax, 2)}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatNumber(p.freightCost, 2)}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.brlFrete, 'BRL')}</td>
                        <td className="py-2 px-2.5 font-mono">{p.blAwb}</td>
                        <td className="py-2 px-2.5 font-mono">{p.master}</td>
                        <td className="py-2 px-2.5">{p.modal}</td>
                        <td className="py-2 px-2.5 font-mono">{p.incoterm}</td>
                        <td className="py-2 px-2.5">{p.cntr}</td>
                        <td className="py-2 px-2.5 font-mono">{p.seal}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{p.c20}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{p.c40}</td>
                        <td className="py-2 px-2.5">{p.invPck}</td>
                        <td className="py-2 px-2.5">{p.origBl}</td>
                        <td className="py-2 px-2.5">{p.regTrib}</td>
                        <td className="py-2 px-2.5 border-r border-slate-200 dark:border-slate-800">{p.acSub}</td>
                      </>
                    )}
                    {visibleGroups.PRE_ALERT && (
                      <>
                        <td className="py-2 px-2.5 font-mono">{p.ie}</td>
                        <td className="py-2 px-2.5">{p.broker}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatNumber(p.valorPreAlert, 2)}</td>
                        <td className="py-2 px-2.5 font-mono">{p.preAlert}</td>
                        <td className="py-2 px-2.5 font-mono">{p.diDraft}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatNumber(p.ptaxPreAlert, 2)}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.invoiceValue, p.currency)}</td>
                        <td className="py-2 px-2.5 font-mono">{p.currency}</td>
                        <td className="py-2 px-2.5 font-mono">{p.miro}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.brlInvoice, 'BRL')}</td>
                        <td className="py-2 px-2.5 font-mono">{p.paid}</td>
                        <td className="py-2 px-2.5 font-mono">{p.trackingNum}</td>
                        <td className="py-2 px-2.5">{p.docBroker}</td>
                        <td className="py-2 px-2.5 border-r border-slate-200 dark:border-slate-800">{p.blBroker}</td>
                      </>
                    )}
                    {visibleGroups.EMBARQUE && (
                      <>
                        <td className="py-2 px-2.5">{p.fromPort}</td>
                        <td className="py-2 px-2.5 font-mono">{p.etd}</td>
                        <td className="py-2 px-2.5">{p.transshipment}</td>
                        <td className="py-2 px-2.5">{p.transPort}</td>
                        <td className="py-2 px-2.5 font-mono">{p.transEta}</td>
                        <td className="py-2 px-2.5 font-mono">{p.transEtd}</td>
                        <td className="py-2 px-2.5 font-mono">{p.eta}</td>
                        <td className="py-2 px-2.5 font-mono border-r border-slate-200 dark:border-slate-800">{p.etaFactory}</td>
                      </>
                    )}
                    {visibleGroups.DESEMBARACO && (
                      <>
                        <td className="py-2 px-2.5 font-mono">{p.berthing}</td>
                        <td className="py-2 px-2.5">{p.terminal}</td>
                        <td className="py-2 px-2.5 font-mono">{p.presenca}</td>
                        <td className="py-2 px-2.5 font-mono">{p.numerario}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.valorAdt, 'BRL')}</td>
                        <td className="py-2 px-2.5 font-mono">{p.registro}</td>
                        <td className="py-2 px-2.5 font-mono">{p.diNum}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatNumber(p.ptaxDi, 2)}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.impostos, 'BRL')}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.afrmm, 'BRL')}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.ecotax, 'BRL')}</td>
                        <td className="py-2 px-2.5">
                          {p.canal !== '-' ? (
                            <StatusBadge label={p.canal} tone={getChannelTone(p.canal)} />
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-2 px-2.5 font-mono">{p.desCi}</td>
                        <td className="py-2 px-2.5">{p.espelho}</td>
                        <td className="py-2 px-2.5">{p.minuta}</td>
                        <td className="py-2 px-2.5">{p.nfStatus}</td>
                        <td className="py-2 px-2.5 font-mono">{p.nfNum}</td>
                        <td className="py-2 px-2.5">{p.transportadora}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.freteNac, 'BRL')}</td>
                        <td className="py-2 px-2.5 font-mono border-r border-slate-200 dark:border-slate-800">{p.recebimento}</td>
                      </>
                    )}
                    {visibleGroups.ESTADIA && (
                      <>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{p.days}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{p.periodos}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.armazenagem, 'BRL')}</td>
                        <td className="py-2 px-2.5 font-mono">{p.devCtnr}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.demurrage, 'BRL')}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{p.transitTime}d</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums border-r border-slate-200 dark:border-slate-800">{p.leadTime}d</td>
                      </>
                    )}
                    {visibleGroups.CUSTOS && (
                      <>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.warehouse, 'BRL')}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.trucking, 'BRL')}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.brokerFee, 'BRL')}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.freightTotal, 'BRL')}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.liFee, 'BRL')}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.demurrageTotal, 'BRL')}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(p.totalCostBrl, 'BRL')}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.brlCif, 'BRL')}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.brlFob, 'BRL')}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{formatCurrency(p.usdFob, 'USD')}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{p.pctCostCif}%</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{p.pctCostFob}%</td>
                        <td className="py-2 px-2.5">
                          <StatusBadge label={p.status} tone={getShipmentStatusTone(p.status)} />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Process Detail & Inline Operational Editor Drawer */}
      {activeProcess && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label={`Process details for ${activeProcess.ref}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) onSelectProcessRef(null);
          }}
        >
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400">
                  {activeProcess.ref} · {activeProcess.modal} · {activeProcess.incoterm}
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {activeProcess.exporter}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeProcess.linha} · BL/AWB {activeProcess.blAwb} · DI {activeProcess.diNum}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectProcessRef(null)}
                aria-label="Close process drawer"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PO Items inside this Process */}
            <div>
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Linked SAP PO Items ({activeProcess.items.length})
              </h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-3">PO / Item</th>
                      <th className="py-2 px-3">Material</th>
                      <th className="py-2 px-3">NCM</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Net Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activeProcess.items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2 px-3 font-mono">{it.PEDIDO}/{it.ITEM_PEDIDO}</td>
                        <td className="py-2 px-3">
                          <div className="font-mono text-[11px] text-slate-500">{it.MATERIAL}</div>
                          <div className="text-slate-900 dark:text-slate-100">{it.DESCRICAO_MATERIAL}</div>
                        </td>
                        <td className="py-2 px-3 font-mono">{it.FUP_NCMS}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {formatNumber(it.QUANTIDADE_PEDIDA, 0)} {it.UNIDADE}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {formatCurrency(it.VALOR_LIQUIDO, it.MOEDA)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Operational Override Form */}
            <form onSubmit={handleSaveDrawer} className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Operational Workbench Fields (Saved locally in browser)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-400">Analyst (RESP)</span>
                  <input
                    type="text"
                    value={draft.resp || ''}
                    onChange={(e) => setDraft({ ...draft, resp: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-400">Operational Status</span>
                  <select
                    value={draft.status || 'EM TRÂNSITO'}
                    onChange={(e) =>
                      setDraft({ ...draft, status: e.target.value as ShipmentOperationalStatus })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-400">Broker Fee (BRL)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.brokerFee ?? 0}
                    onChange={(e) => setDraft({ ...draft, brokerFee: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-400">Road Trucking Cost (BRL)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.truckingCost ?? 0}
                    onChange={(e) => setDraft({ ...draft, truckingCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-400">LI Fee (BRL)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.liFee ?? 0}
                    onChange={(e) => setDraft({ ...draft, liFee: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-400">Demurrage Cost (BRL)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.demurrageCost ?? 0}
                    onChange={(e) => setDraft({ ...draft, demurrageCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-400">Container Return Date (Dev. CTNR)</span>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={draft.devCtnrDate || ''}
                    onChange={(e) => setDraft({ ...draft, devCtnrDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-400">Courier / Doc Tracking #</span>
                  <input
                    type="text"
                    value={draft.trackingNum || ''}
                    onChange={(e) => setDraft({ ...draft, trackingNum: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onSelectProcessRef(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Operational Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

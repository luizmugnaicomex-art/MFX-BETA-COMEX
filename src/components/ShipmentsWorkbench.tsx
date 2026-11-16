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
import { useI18n } from '../i18n/I18nContext';
import {
  translateChannel,
  translateModal,
  translateShipmentStatus,
} from '../i18n/helpers';

type GroupKey =
  | 'IDENTIFICATION'
  | 'PROCESSO'
  | 'PRE_ALERT'
  | 'EMBARQUE'
  | 'DESEMBARACO'
  | 'ESTADIA'
  | 'CUSTOS';

const GROUP_KEYS: GroupKey[] = [
  'IDENTIFICATION',
  'PROCESSO',
  'PRE_ALERT',
  'EMBARQUE',
  'DESEMBARACO',
  'ESTADIA',
  'CUSTOS',
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
  const { lang, tr, fmt } = useI18n();
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
            {tr.shipments.stageGroups}
          </span>
          {GROUP_KEYS.map((key) => {
            const active = visibleGroups[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleGroup(key)}
                disabled={key === 'IDENTIFICATION'}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-cyan-500/15 dark:text-cyan-200 dark:border-cyan-500/35'
                    : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-950 dark:text-slate-500 dark:border-slate-800'
                } ${key === 'IDENTIFICATION' ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
              >
                {active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {tr.shipments.groupShort[key]}
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
          {tr.shipments.exportBtn}
        </button>
      </div>

      {/* Exact Multi-Header Replicated Workbench Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {processes.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {tr.shipments.emptyState}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[680px]">
            <table className="w-max min-w-full border-collapse text-[11px]">
              <thead className="sticky top-0 z-20">
                {/* Super-Header Row */}
                <tr>
                  {visibleGroups.IDENTIFICATION && (
                    <th colSpan={7} className="py-1.5 px-2 text-left font-semibold bg-slate-800 text-slate-100 border-r border-slate-700">
                      {tr.shipments.groupFull.IDENTIFICATION}
                    </th>
                  )}
                  {visibleGroups.PROCESSO && (
                    <th colSpan={16} className="py-1.5 px-2 text-left font-semibold bg-cyan-900 text-cyan-100 border-r border-cyan-800">
                      {tr.shipments.groupFull.PROCESSO}
                    </th>
                  )}
                  {visibleGroups.PRE_ALERT && (
                    <th colSpan={14} className="py-1.5 px-2 text-left font-semibold bg-indigo-900 text-indigo-100 border-r border-indigo-800">
                      {tr.shipments.groupFull.PRE_ALERT}
                    </th>
                  )}
                  {visibleGroups.EMBARQUE && (
                    <th colSpan={8} className="py-1.5 px-2 text-left font-semibold bg-sky-900 text-sky-100 border-r border-sky-800">
                      {tr.shipments.groupFull.EMBARQUE}
                    </th>
                  )}
                  {visibleGroups.DESEMBARACO && (
                    <th colSpan={20} className="py-1.5 px-2 text-left font-semibold bg-amber-900 text-amber-100 border-r border-amber-800">
                      {tr.shipments.groupFull.DESEMBARACO}
                    </th>
                  )}
                  {visibleGroups.ESTADIA && (
                    <th colSpan={7} className="py-1.5 px-2 text-left font-semibold bg-rose-900 text-rose-100 border-r border-rose-800">
                      {tr.shipments.groupFull.ESTADIA}
                    </th>
                  )}
                  {visibleGroups.CUSTOS && (
                    <th colSpan={13} className="py-1.5 px-2 text-left font-semibold bg-emerald-900 text-emerald-100">
                      {tr.shipments.groupFull.CUSTOS}
                    </th>
                  )}
                </tr>

                {/* Sub-Header Column Row */}
                <tr className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                  {visibleGroups.IDENTIFICATION && (
                    <>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.resp}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.ref}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.exporter}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.line}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.pi}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.po}</th>
                      <th className="py-2 px-2.5 font-medium border-r border-slate-300 dark:border-slate-700">{tr.shipments.cols.ac}</th>
                    </>
                  )}
                  {visibleGroups.PROCESSO && (
                    <>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.forwarder}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.ptax}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.freightCost}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.brlFreight}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.blAwb}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.master}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.modal}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.incoterm}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.cntr}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.seal}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.c20}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.c40}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.invPck}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.origBl}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.regTrib}</th>
                      <th className="py-2 px-2.5 font-medium border-r border-slate-300 dark:border-slate-700">{tr.shipments.cols.acSub}</th>
                    </>
                  )}
                  {visibleGroups.PRE_ALERT && (
                    <>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.ie}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.broker}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.value}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.preAlert}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.diDraft}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.ptax}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.invoiceValue}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.currency}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.miro}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.brlInvoice}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.paid}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.tracking}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.docBroker}</th>
                      <th className="py-2 px-2.5 font-medium border-r border-slate-300 dark:border-slate-700">{tr.shipments.cols.blBroker}</th>
                    </>
                  )}
                  {visibleGroups.EMBARQUE && (
                    <>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.from}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.etd}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.transshipment}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.port}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.transEta}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.transEtd}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.eta}</th>
                      <th className="py-2 px-2.5 font-medium border-r border-slate-300 dark:border-slate-700">{tr.shipments.cols.etaFactory}</th>
                    </>
                  )}
                  {visibleGroups.DESEMBARACO && (
                    <>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.berthing}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.terminal}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.presenca}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.numerario}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.valorAdt}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.registro}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.diNum}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.ptax}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.taxes}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.afrmm}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.ecotax}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.canal}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.desCi}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.espelho}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.minuta}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.nf}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.nfNum}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.carrier}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.freightNac}</th>
                      <th className="py-2 px-2.5 font-medium border-r border-slate-300 dark:border-slate-700">{tr.shipments.cols.receiving}</th>
                    </>
                  )}
                  {visibleGroups.ESTADIA && (
                    <>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.days}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.periods}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.storage}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.devCtnr}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.demurrage}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.tt}</th>
                      <th className="py-2 px-2.5 font-medium text-right border-r border-slate-300 dark:border-slate-700">{tr.shipments.cols.lead}</th>
                    </>
                  )}
                  {visibleGroups.CUSTOS && (
                    <>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.warehouse}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.trucking}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.broker}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.freight}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.li}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.demurrage}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.cost}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.brlCif}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.brlFob}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.usdFob}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.pctCif}</th>
                      <th className="py-2 px-2.5 font-medium text-right">{tr.shipments.cols.pctFob}</th>
                      <th className="py-2 px-2.5 font-medium">{tr.shipments.cols.status}</th>
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
                        <td className="py-2 px-2.5">{translateModal(p.modal, lang)}</td>
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
                            <StatusBadge label={translateChannel(p.canal, lang)} tone={getChannelTone(p.canal)} />
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
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums">{p.transitTime}{tr.common.daysSuffix}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums border-r border-slate-200 dark:border-slate-800">{p.leadTime}{tr.common.daysSuffix}</td>
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
                          <StatusBadge
                            label={translateShipmentStatus(p.status, lang)}
                            tone={getShipmentStatusTone(p.status)}
                          />
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
          aria-label={fmt(tr.shipments.drawerAriaLabel, { ref: activeProcess.ref })}
          onClick={(e) => {
            if (e.target === e.currentTarget) onSelectProcessRef(null);
          }}
        >
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400">
                  {activeProcess.ref} · {translateModal(activeProcess.modal, lang)} · {activeProcess.incoterm}
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
                aria-label={tr.shipments.closeDrawer}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PO Items inside this Process */}
            <div>
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {fmt(tr.shipments.linkedPoItems, { count: activeProcess.items.length })}
              </h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-3">{tr.shipments.poItemCol}</th>
                      <th className="py-2 px-3">{tr.shipments.materialCol}</th>
                      <th className="py-2 px-3">{tr.shipments.ncmCol}</th>
                      <th className="py-2 px-3 text-right">{tr.shipments.qtyCol}</th>
                      <th className="py-2 px-3 text-right">{tr.shipments.netValueCol}</th>
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
                {tr.shipments.formHeading}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-400">{tr.shipments.analystLabel}</span>
                  <input
                    type="text"
                    value={draft.resp || ''}
                    onChange={(e) => setDraft({ ...draft, resp: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-400">{tr.shipments.opStatusLabel}</span>
                  <select
                    value={draft.status || 'EM TRÂNSITO'}
                    onChange={(e) =>
                      setDraft({ ...draft, status: e.target.value as ShipmentOperationalStatus })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {translateShipmentStatus(st, lang)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-400">{tr.shipments.brokerFeeLabel}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.brokerFee ?? 0}
                    onChange={(e) => setDraft({ ...draft, brokerFee: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-400">{tr.shipments.truckingCostLabel}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.truckingCost ?? 0}
                    onChange={(e) => setDraft({ ...draft, truckingCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-400">{tr.shipments.liFeeLabel}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.liFee ?? 0}
                    onChange={(e) => setDraft({ ...draft, liFee: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-400">{tr.shipments.demurrageCostLabel}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.demurrageCost ?? 0}
                    onChange={(e) => setDraft({ ...draft, demurrageCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-400">{tr.shipments.cntrReturnLabel}</span>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={draft.devCtnrDate || ''}
                    onChange={(e) => setDraft({ ...draft, devCtnrDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-400">{tr.shipments.trackingLabel}</span>
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
                  {tr.common.cancel}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  <Save className="w-3.5 h-3.5" />
                  {tr.shipments.saveOperational}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

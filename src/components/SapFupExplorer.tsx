import React, { useState } from 'react';
import { Upload, FileSpreadsheet, RotateCcw, Code2 } from 'lucide-react';
import type { FupItemRow } from '../types/comex';
import { downloadSampleFupTemplate } from '../utils/exportReports';
import { formatCurrency, formatNumber } from '../utils/sapParser';
import { StatusBadge, getDeliveryStatusTone } from './StatusBadge';

interface SapFupExplorerProps {
  items: FupItemRow[];
  dataSourceLabel: string;
  onUploadFile: (file: File) => void;
  onResetToSeed: () => void;
}

export const SapFupExplorer: React.FC<SapFupExplorerProps> = ({
  items,
  dataSourceLabel,
  onUploadFile,
  onResetToSeed,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FupItemRow | null>(items[0] || null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUploadFile(file);
  };

  return (
    <div className="space-y-6">
      {/* Master Drag-and-Drop SAP Extraction Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-6 transition-colors ${
          isDragging
            ? 'border-cyan-500 bg-cyan-500/10'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400">
              ACTIVE DATASET: {dataSourceLabel} · {items.length} SAP ROWS
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Master SAP Extraction Ingestion (FUP COMEX.xlsx)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
              Drag and drop your <span className="font-mono">FUP COMEX.xlsx</span> file (sheet{' '}
              <span className="font-mono">comex FUP</span>) here. Parses both flat SAP MM/FI/Comex columns
              and embedded JSON columns (<span className="font-mono">PROCESSOS_JSON</span>,{' '}
              <span className="font-mono">DETALHES_FISCAIS_JSON</span>,{' '}
              <span className="font-mono">FATURAS_JSON</span>,{' '}
              <span className="font-mono">FINANCEIRO_JSON</span>).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white">
              <Upload className="w-3.5 h-3.5" />
              Select FUP COMEX.xlsx
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadFile(file);
                }}
              />
            </label>

            <button
              type="button"
              onClick={downloadSampleFupTemplate}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Download Sample FUP COMEX.xlsx
            </button>

            <button
              type="button"
              onClick={onResetToSeed}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset MFX Seed
            </button>
          </div>
        </div>
      </div>

      {/* Parsed SAP Items + Decoded JSON Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Normalized SAP FUP Rows
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click any row to inspect its parsed SAP JSON structures on the right
            </p>
          </div>
          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                  <th className="py-2 px-3">PO / Item</th>
                  <th className="py-2 px-3">MFX Ref</th>
                  <th className="py-2 px-3">Material</th>
                  <th className="py-2 px-3">Ato Concess.</th>
                  <th className="py-2 px-3 text-right">Net Value</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {items.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedItem(row)}
                    className={`cursor-pointer transition-colors ${
                      selectedItem?.id === row.id
                        ? 'bg-cyan-500/10 dark:bg-cyan-500/15'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-2 px-3 font-mono whitespace-nowrap">
                      {row.PEDIDO}/{row.ITEM_PEDIDO}
                    </td>
                    <td className="py-2 px-3 font-mono text-cyan-700 dark:text-cyan-300 whitespace-nowrap">
                      {row.ULTIMO_PROCESSO_IMPORTACAO || '-'}
                    </td>
                    <td className="py-2 px-3 max-w-[200px] truncate" title={row.DESCRICAO_MATERIAL}>
                      <span className="font-mono text-[11px] text-slate-500 mr-1.5">{row.MATERIAL}</span>
                      {row.DESCRICAO_MATERIAL}
                    </td>
                    <td className="py-2 px-3 font-mono whitespace-nowrap">
                      {row.FUP_ATO_CONCESSORIO || '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatCurrency(row.VALOR_LIQUIDO, row.MOEDA)}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
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

        {/* JSON Inspector */}
        <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                SAP Embedded JSON Payload Inspector
              </h3>
            </div>
            {selectedItem && (
              <span className="text-xs font-mono text-slate-500">
                PO {selectedItem.PEDIDO} · {formatNumber(selectedItem.ESTOQUE_SOMA_TRES_CATEGORIAS_PLANTA_0003, 0)} stock
              </span>
            )}
          </div>

          {selectedItem ? (
            <div className="space-y-3 max-h-[410px] overflow-y-auto pr-1 text-[11px]">
              <div>
                <div className="font-mono font-semibold text-cyan-700 dark:text-cyan-300 mb-1">
                  PROCESSOS_JSON ({selectedItem.processos.length})
                </div>
                <pre className="p-2.5 rounded-lg bg-slate-950 text-slate-200 overflow-x-auto font-mono">
                  {JSON.stringify(selectedItem.processos, null, 2)}
                </pre>
              </div>

              <div>
                <div className="font-mono font-semibold text-amber-700 dark:text-amber-300 mb-1">
                  DETALHES_FISCAIS_JSON ({selectedItem.detalhesFiscais.length})
                </div>
                <pre className="p-2.5 rounded-lg bg-slate-950 text-slate-200 overflow-x-auto font-mono">
                  {JSON.stringify(selectedItem.detalhesFiscais, null, 2)}
                </pre>
              </div>

              <div>
                <div className="font-mono font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
                  FATURAS_JSON ({selectedItem.faturas.length}) &amp; FINANCEIRO_JSON ({selectedItem.financeiro.length})
                </div>
                <pre className="p-2.5 rounded-lg bg-slate-950 text-slate-200 overflow-x-auto font-mono">
                  {JSON.stringify(
                    { faturas: selectedItem.faturas, financeiro: selectedItem.financeiro },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              Select a row on the left to inspect its parsed SAP JSON structures.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

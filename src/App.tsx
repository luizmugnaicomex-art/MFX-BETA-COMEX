import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Database,
  DollarSign,
  Grid3x3,
  Moon,
  RotateCcw,
  Search,
  Ship,
  Sun,
  Upload,
  Users,
  X,
} from 'lucide-react';
import type {
  ComexFilters,
  FupItemRow,
  ShipmentOverrides,
  SwotData,
} from './types/comex';
import { INITIAL_MFX_SEED_DATA } from './data/mfxSeedData';
import { parseFupWorkbook } from './utils/sapParser';
import { buildShipmentProcesses, filterFupItems } from './utils/comexEngine';
import { ExecutivePanel } from './components/ExecutivePanel';
import { ShipmentsWorkbench } from './components/ShipmentsWorkbench';
import { OrderStatusMatrix } from './components/OrderStatusMatrix';
import { PaymentsCashFlow } from './components/PaymentsCashFlow';
import { PartnerSwotCenter } from './components/PartnerSwotCenter';
import { SapFupExplorer } from './components/SapFupExplorer';

type TabId =
  | 'monitoring'
  | 'shipments'
  | 'matrix'
  | 'payments'
  | 'partners'
  | 'explorer';

const LS_OVERRIDES_KEY = 'mfx_comex_shipment_overrides_v1';
const LS_QTD_AC_KEY = 'mfx_comex_qtd_ac_overrides_v1';
const LS_SWOT_KEY = 'mfx_comex_custom_swots_v1';
const LS_THEME_KEY = 'mfx_comex_theme_v1';

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const DEFAULT_FILTERS: ComexFilters = {
  search: '',
  pep: '',
  atoConcessorio: '',
  supplier: '',
  ncm: '',
  buyer: '',
  status: '',
  hideDeleted: true,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('monitoring');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(LS_THEME_KEY);
    return saved ? saved === 'dark' : true;
  });

  const [rawItems, setRawItems] = useState<FupItemRow[]>(INITIAL_MFX_SEED_DATA);
  const [dataSourceLabel, setDataSourceLabel] = useState<string>('MFX Baseline Dataset');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadBanner, setUploadBanner] = useState<string | null>(null);

  const [filters, setFilters] = useState<ComexFilters>(DEFAULT_FILTERS);
  const [selectedProcessRef, setSelectedProcessRef] = useState<string | null>(null);

  const [shipmentOverrides, setShipmentOverrides] = useState<Record<string, ShipmentOverrides>>(() =>
    readStorage(LS_OVERRIDES_KEY, {})
  );
  const [qtdAcOverrides, setQtdAcOverrides] = useState<Record<string, number>>(() =>
    readStorage(LS_QTD_AC_KEY, {})
  );
  const [customSwots, setCustomSwots] = useState<Record<string, SwotData>>(() =>
    readStorage(LS_SWOT_KEY, {})
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(LS_THEME_KEY, isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem(LS_OVERRIDES_KEY, JSON.stringify(shipmentOverrides));
  }, [shipmentOverrides]);

  useEffect(() => {
    localStorage.setItem(LS_QTD_AC_KEY, JSON.stringify(qtdAcOverrides));
  }, [qtdAcOverrides]);

  useEffect(() => {
    localStorage.setItem(LS_SWOT_KEY, JSON.stringify(customSwots));
  }, [customSwots]);

  const filterOptions = useMemo(() => {
    const peps = new Set<string>();
    const acs = new Set<string>();
    const suppliers = new Set<string>();
    const ncms = new Set<string>();
    const buyers = new Set<string>();
    const statuses = new Set<string>();

    for (const item of rawItems) {
      if (item.DESCRICAO_ELEMENTO_PEP) peps.add(item.DESCRICAO_ELEMENTO_PEP);
      if (item.FUP_ATO_CONCESSORIO) acs.add(item.FUP_ATO_CONCESSORIO);
      if (item.NOME_FORNECEDOR) suppliers.add(item.NOME_FORNECEDOR);
      if (item.FUP_NCMS) ncms.add(item.FUP_NCMS);
      if (item.NOME_COMPRADOR) buyers.add(item.NOME_COMPRADOR);
      if (item.STATUS_PRAZO_ENTREGA) statuses.add(item.STATUS_PRAZO_ENTREGA);
    }
    return {
      peps: Array.from(peps).sort(),
      acs: Array.from(acs).sort(),
      suppliers: Array.from(suppliers).sort(),
      ncms: Array.from(ncms).sort(),
      buyers: Array.from(buyers).sort(),
      statuses: Array.from(statuses).sort(),
    };
  }, [rawItems]);

  const filteredItems = useMemo(() => filterFupItems(rawItems, filters), [rawItems, filters]);

  const processes = useMemo(
    () => buildShipmentProcesses(filteredItems, shipmentOverrides),
    [filteredItems, shipmentOverrides]
  );

  const deletedCount = useMemo(
    () =>
      rawItems.filter(
        (i) => i.LOEKZ === 'L' || i.STATUS_PRAZO_ENTREGA === 'ITEM EXCLUIDO'
      ).length,
    [rawItems]
  );

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.search ||
          filters.pep ||
          filters.atoConcessorio ||
          filters.supplier ||
          filters.ncm ||
          filters.buyer ||
          filters.status ||
          !filters.hideDeleted
      ),
    [filters]
  );

  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    setUploadBanner(null);
    try {
      const buffer = await file.arrayBuffer();
      const { items, sheetName } = parseFupWorkbook(buffer);
      if (items.length === 0) {
        setUploadError(`Worksheet "${sheetName}" in ${file.name} did not contain any valid SAP rows.`);
        return;
      }
      setRawItems(items);
      setDataSourceLabel(`${file.name} (${sheetName})`);
      setUploadBanner(`Loaded ${items.length} SAP FUP rows from "${file.name}" (sheet: ${sheetName}).`);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Failed to parse the uploaded Excel workbook.'
      );
    }
  };

  const handleSaveOverride = (ref: string, next: ShipmentOverrides) => {
    setShipmentOverrides((prev) => ({
      ...prev,
      [ref]: { ...(prev[ref] || {}), ...next },
    }));
  };

  const handleUpdateQtdAc = (key: string, value: number) => {
    setQtdAcOverrides((prev) => ({ ...prev, [key]: value }));
  };

  const handleUpdateSwot = (partnerId: string, next: SwotData) => {
    setCustomSwots((prev) => ({ ...prev, [partnerId]: next }));
  };

  const navItems: Array<{
    id: TabId;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
  }> = [
    {
      id: 'monitoring',
      label: 'Monitoring Control',
      shortLabel: 'Executive',
      icon: Activity,
      badge: filteredItems.filter((i) => i.QUANTIDADE_PENDENTE > 0).length,
    },
    {
      id: 'shipments',
      label: 'Shipments Comex',
      shortLabel: 'Shipments',
      icon: Ship,
      badge: processes.length,
    },
    {
      id: 'matrix',
      label: 'Order Status Matrix',
      shortLabel: 'Matrix',
      icon: Grid3x3,
    },
    {
      id: 'payments',
      label: 'Payments & Cash Flow',
      shortLabel: 'Cash Flow',
      icon: DollarSign,
    },
    {
      id: 'partners',
      label: 'Partner 360° & SWOT',
      shortLabel: 'SWOT',
      icon: Users,
    },
    {
      id: 'explorer',
      label: 'SAP FUP Explorer',
      shortLabel: 'SAP FUP',
      icon: Database,
      badge: rawItems.length,
    },
  ];

  const activeNav = navItems.find((n) => n.id === activeTab) || navItems[0];

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Collapsible Left Sidebar */}
      <aside
        className={`shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col transition-all duration-200 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="h-14 px-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          {!sidebarCollapsed && (
            <span className="font-display font-bold text-sm tracking-tight text-slate-900 dark:text-white whitespace-nowrap truncate">
              MFX Comex Control
            </span>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 ml-auto"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1" aria-label="Comex modules">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-600 text-white dark:bg-cyan-500/20 dark:text-cyan-200 border border-transparent dark:border-cyan-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </span>
                {!sidebarCollapsed && item.badge !== undefined && (
                  <span
                    className={`font-mono tabular-nums text-[11px] px-1.5 py-0.5 rounded ${
                      isActive
                        ? 'bg-white/20 text-white dark:bg-cyan-500/25 dark:text-cyan-100'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {!sidebarCollapsed && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
            <div className="font-medium text-slate-700 dark:text-slate-300 truncate">
              {dataSourceLabel}
            </div>
            <div className="font-mono tabular-nums">
              {filteredItems.length} visible · {deletedCount} deleted SAP
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sticky Top Command Bar */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-5 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="font-display text-base font-bold text-slate-900 dark:text-white whitespace-nowrap truncate">
                {activeNav.label}
              </h1>
              <span className="hidden sm:inline text-xs text-slate-400">/</span>
              <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap truncate">
                MFX Intelligent Comex Control &amp; Monitoring System
              </span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                aria-label="Upload FUP COMEX.xlsx file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload FUP COMEX.xlsx
              </button>

              <button
                type="button"
                onClick={() => setIsDark((d) => !d)}
                aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Global Multi-Filters & Deleted SAP Toggle */}
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap xl:flex-nowrap items-center gap-1.5">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                aria-label="Global Comex search"
                placeholder="Search PO, MFX, PEP, AC, NCM..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <select
              aria-label="Filter by Project PEP"
              value={filters.pep}
              onChange={(e) => setFilters((f) => ({ ...f, pep: e.target.value }))}
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white max-w-[138px]"
            >
              <option value="">All Projects</option>
              {filterOptions.peps.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by Ato Concessório"
              value={filters.atoConcessorio}
              onChange={(e) => setFilters((f) => ({ ...f, atoConcessorio: e.target.value }))}
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white max-w-[125px]"
            >
              <option value="">All ACs</option>
              <option value="__MISSING__">Missing AC</option>
              {filterOptions.acs.map((ac) => (
                <option key={ac} value={ac}>
                  AC {ac}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by Supplier"
              value={filters.supplier}
              onChange={(e) => setFilters((f) => ({ ...f, supplier: e.target.value }))}
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white max-w-[138px]"
            >
              <option value="">All Suppliers</option>
              {filterOptions.suppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by NCM"
              value={filters.ncm}
              onChange={(e) => setFilters((f) => ({ ...f, ncm: e.target.value }))}
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white max-w-[105px]"
            >
              <option value="">All NCMs</option>
              {filterOptions.ncms.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by Buyer"
              value={filters.buyer}
              onChange={(e) => setFilters((f) => ({ ...f, buyer: e.target.value }))}
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white max-w-[110px]"
            >
              <option value="">All Buyers</option>
              {filterOptions.buyers.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by Delivery Status"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white max-w-[115px]"
            >
              <option value="">All Status</option>
              {filterOptions.statuses.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0">
              <input
                type="checkbox"
                checked={filters.hideDeleted}
                onChange={(e) => setFilters((f) => ({ ...f, hideDeleted: e.target.checked }))}
                className="accent-cyan-600 rounded"
              />
              <span>Hide Deleted (LOEKZ=&apos;L&apos;)</span>
            </label>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        </header>

        {/* Notifications for File Upload */}
        {(uploadError || uploadBanner) && (
          <div className="px-5 pt-4">
            {uploadError && (
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs">
                <span>{uploadError}</span>
                <button
                  type="button"
                  onClick={() => setUploadError(null)}
                  aria-label="Dismiss error"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {uploadBanner && (
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs">
                <span>{uploadBanner}</span>
                <button
                  type="button"
                  onClick={() => setUploadBanner(null)}
                  aria-label="Dismiss message"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Active Module Viewport */}
        <main className="flex-1 p-5">
          {activeTab === 'monitoring' && (
            <ExecutivePanel
              items={filteredItems}
              processes={processes}
              onSelectProcess={(ref) => {
                setSelectedProcessRef(ref);
                setActiveTab('shipments');
              }}
              onFilterByNcm={(ncm) => setFilters((f) => ({ ...f, ncm: f.ncm === ncm ? '' : ncm }))}
            />
          )}

          {activeTab === 'shipments' && (
            <ShipmentsWorkbench
              processes={processes}
              overrides={shipmentOverrides}
              onSaveOverride={handleSaveOverride}
              selectedProcessRef={selectedProcessRef}
              onSelectProcessRef={setSelectedProcessRef}
            />
          )}

          {activeTab === 'matrix' && (
            <OrderStatusMatrix
              items={filteredItems}
              overrides={shipmentOverrides}
              qtdAcOverrides={qtdAcOverrides}
              onUpdateQtdAc={handleUpdateQtdAc}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentsCashFlow items={filteredItems} processes={processes} />
          )}

          {activeTab === 'partners' && (
            <PartnerSwotCenter
              items={filteredItems}
              processes={processes}
              customSwots={customSwots}
              onUpdateSwot={handleUpdateSwot}
            />
          )}

          {activeTab === 'explorer' && (
            <SapFupExplorer
              items={filteredItems}
              dataSourceLabel={dataSourceLabel}
              onUploadFile={handleFileUpload}
              onResetToSeed={() => {
                setRawItems(INITIAL_MFX_SEED_DATA);
                setDataSourceLabel('MFX Baseline Dataset');
                setUploadBanner('Restored MFX baseline dataset.');
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

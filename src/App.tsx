import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CopyCheck,
  Database,
  DollarSign,
  Grid3x3,
  Layers,
  Moon,
  Receipt,
  RotateCcw,
  Scale,
  Search,
  Ship,
  Sun,
  Target,
  Upload,
  Users,
  X,
} from 'lucide-react';
import type {
  ComexFilters,
  DateFilterBasis,
  FupItemRow,
  KraljicOverride,
  NumerarioOverride,
  ShipmentOverrides,
  SimilarGroupDecision,
  SwotData,
} from './types/comex';
import { INITIAL_MFX_SEED_DATA } from './data/mfxSeedData';
import { parseFupWorkbook } from './utils/sapParser';
import {
  buildMaterialAnalytics,
  buildNumerarioAnalysis,
  buildShipmentProcesses,
  buildShipmentWorthinessAnalysis,
  detectSimilarMaterials,
  extractAvailableYears,
  filterFupItems,
} from './utils/comexEngine';
import { ExecutivePanel } from './components/ExecutivePanel';
import { ShipmentsWorkbench } from './components/ShipmentsWorkbench';
import { OrderStatusMatrix } from './components/OrderStatusMatrix';
import { PaymentsCashFlow } from './components/PaymentsCashFlow';
import { PartnerSwotCenter } from './components/PartnerSwotCenter';
import { SapFupExplorer } from './components/SapFupExplorer';
import { PqrControlPanel } from './components/PqrControlPanel';
import { KraljicMatrixPanel } from './components/KraljicMatrixPanel';
import { SimilarItemsPanel } from './components/SimilarItemsPanel';
import { NumerarioCostsPanel } from './components/NumerarioCostsPanel';
import { ShipmentWorthinessPanel } from './components/ShipmentWorthinessPanel';
import { ComexChartsPanel } from './components/ComexChartsPanel';
import { useI18n } from './i18n/I18nContext';
import { LANGUAGE_OPTIONS } from './i18n/translations';
import { translateDeliveryStatus } from './i18n/helpers';

type TabId =
  | 'monitoring'
  | 'comexCharts'
  | 'shipments'
  | 'matrix'
  | 'pqr'
  | 'kraljic'
  | 'similar'
  | 'numerario'
  | 'worth'
  | 'payments'
  | 'partners'
  | 'explorer';

const LS_OVERRIDES_KEY = 'mfx_comex_shipment_overrides_v1';
const LS_QTD_AC_KEY = 'mfx_comex_qtd_ac_overrides_v1';
const LS_SWOT_KEY = 'mfx_comex_custom_swots_v1';
const LS_KRALJIC_KEY = 'mfx_comex_kraljic_overrides_v1';
const LS_SIMILAR_KEY = 'mfx_comex_similar_decisions_v1';
const LS_NUMERARIO_KEY = 'mfx_comex_numerario_overrides_v1';
const LS_THEME_KEY = 'mfx_comex_theme_v1';

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const MONTH_KEYS = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
] as const;

const DEFAULT_FILTERS: ComexFilters = {
  search: '',
  pep: '',
  atoConcessorio: '',
  supplier: '',
  ncm: '',
  buyer: '',
  status: '',
  year: '',
  month: '',
  dateField: 'OPS',
  hideDeleted: true,
};

export default function App() {
  const { lang, setLang, tr, fmt } = useI18n();
  const [activeTab, setActiveTab] = useState<TabId>('monitoring');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeTab]);

  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(LS_THEME_KEY);
    return saved ? saved === 'dark' : true;
  });

  const [rawItems, setRawItems] = useState<FupItemRow[]>(INITIAL_MFX_SEED_DATA);
  const [uploadedSourceLabel, setUploadedSourceLabel] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadBanner, setUploadBanner] = useState<string | null>(null);
  const dataSourceLabel = uploadedSourceLabel ?? tr.app.baselineDataset;

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
  const [kraljicOverrides, setKraljicOverrides] = useState<Record<string, KraljicOverride>>(() =>
    readStorage(LS_KRALJIC_KEY, {})
  );
  const [similarDecisions, setSimilarDecisions] = useState<Record<string, SimilarGroupDecision>>(
    () => readStorage(LS_SIMILAR_KEY, {})
  );
  const [numerarioOverrides, setNumerarioOverrides] = useState<Record<string, NumerarioOverride>>(
    () => readStorage(LS_NUMERARIO_KEY, {})
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

  useEffect(() => {
    localStorage.setItem(LS_KRALJIC_KEY, JSON.stringify(kraljicOverrides));
  }, [kraljicOverrides]);

  useEffect(() => {
    localStorage.setItem(LS_SIMILAR_KEY, JSON.stringify(similarDecisions));
  }, [similarDecisions]);

  useEffect(() => {
    localStorage.setItem(LS_NUMERARIO_KEY, JSON.stringify(numerarioOverrides));
  }, [numerarioOverrides]);

  const filterOptions = useMemo(() => {
    const peps = new Set<string>();
    const acs = new Set<string>();
    const suppliers = new Set<string>();
    const ncms = new Set<string>();
    const buyers = new Set<string>();
    const statuses = new Set<string>();
    let hasMissingNcm = false;

    for (const item of rawItems) {
      if (item.DESCRICAO_ELEMENTO_PEP) peps.add(item.DESCRICAO_ELEMENTO_PEP);
      if (item.FUP_ATO_CONCESSORIO) {
        for (const ac of item.FUP_ATO_CONCESSORIO.split(',')) {
          const clean = ac.trim();
          if (clean) acs.add(clean);
        }
      }
      if (item.NOME_FORNECEDOR) suppliers.add(item.NOME_FORNECEDOR);
      if (item.FUP_NCMS) {
        for (const ncm of item.FUP_NCMS.split(',')) {
          const clean = ncm.trim();
          if (clean) ncms.add(clean);
        }
      } else {
        hasMissingNcm = true;
      }
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
      hasMissingNcm,
    };
  }, [rawItems]);

  const availableYears = useMemo(
    () => extractAvailableYears(rawItems, filters.dateField),
    [rawItems, filters.dateField]
  );

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
          filters.year ||
          filters.month ||
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
        setUploadError(fmt(tr.app.uploadNoRows, { sheetName, fileName: file.name }));
        return;
      }
      setRawItems(items);
      setFilters(DEFAULT_FILTERS);
      setSelectedProcessRef(null);
      setUploadedSourceLabel(`${file.name} (${sheetName})`);
      setUploadBanner(
        fmt(tr.app.uploadSuccess, { count: items.length, fileName: file.name, sheetName })
      );
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : tr.app.uploadErrorFallback);
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

  const handleSaveKraljicOverride = (
    materialKey: string,
    override: KraljicOverride | null
  ) => {
    setKraljicOverrides((prev) => {
      const next = { ...prev };
      if (!override) {
        delete next[materialKey];
      } else {
        next[materialKey] = override;
      }
      return next;
    });
  };

  const handleSaveSimilarDecision = (
    groupId: string,
    decision: SimilarGroupDecision | null
  ) => {
    setSimilarDecisions((prev) => {
      const next = { ...prev };
      if (!decision) {
        delete next[groupId];
      } else {
        next[groupId] = decision;
      }
      return next;
    });
  };

  const handleSaveNumerarioOverride = (
    id: string,
    override: NumerarioOverride | null
  ) => {
    setNumerarioOverrides((prev) => {
      const next = { ...prev };
      if (!override) {
        delete next[id];
      } else {
        next[id] = override;
      }
      return next;
    });
  };

  const distinctMaterialCount = useMemo(
    () =>
      new Set(
        filteredItems.map((i) => i.MATERIAL || i.DESCRICAO_MATERIAL || i.id)
      ).size,
    [filteredItems]
  );

  const similarGroupCount = useMemo(() => {
    const matAnalytics = buildMaterialAnalytics(filteredItems, kraljicOverrides);
    return detectSimilarMaterials(matAnalytics.materials, similarDecisions, 55).totalGroups;
  }, [filteredItems, kraljicOverrides, similarDecisions]);

  const numerarioPendingCount = useMemo(() => {
    const res = buildNumerarioAnalysis(filteredItems, processes, numerarioOverrides, true);
    return res.counts.pendingCashCallCount;
  }, [filteredItems, processes, numerarioOverrides]);

  const worthFlaggedCount = useMemo(() => {
    const res = buildShipmentWorthinessAnalysis(processes, filteredItems, rawItems);
    return res.summary.notWorthItCount + res.summary.reviewCount;
  }, [processes, filteredItems, rawItems]);

  const navItems: Array<{
    id: TabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
  }> = [
    {
      id: 'monitoring',
      label: tr.nav.monitoring,
      icon: Activity,
      badge: filteredItems.filter((i) => i.QUANTIDADE_PENDENTE > 0).length,
    },
    {
      id: 'comexCharts',
      label: tr.nav.comexCharts,
      icon: BarChart3,
      badge: 12,
    },
    {
      id: 'shipments',
      label: tr.nav.shipments,
      icon: Ship,
      badge: processes.length,
    },
    {
      id: 'matrix',
      label: tr.nav.matrix,
      icon: Grid3x3,
    },
    {
      id: 'pqr',
      label: tr.nav.pqr,
      icon: Layers,
      badge: distinctMaterialCount,
    },
    {
      id: 'kraljic',
      label: tr.nav.kraljic,
      icon: Target,
    },
    {
      id: 'similar',
      label: tr.nav.similar,
      icon: CopyCheck,
      badge: similarGroupCount,
    },
    {
      id: 'numerario',
      label: tr.nav.numerario,
      icon: Receipt,
      badge: numerarioPendingCount,
    },
    {
      id: 'worth',
      label: tr.nav.worth,
      icon: Scale,
      badge: worthFlaggedCount,
    },
    {
      id: 'payments',
      label: tr.nav.payments,
      icon: DollarSign,
    },
    {
      id: 'partners',
      label: tr.nav.partners,
      icon: Users,
    },
    {
      id: 'explorer',
      label: tr.nav.explorer,
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
              {tr.app.brand}
            </span>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? tr.app.expandSidebar : tr.app.collapseSidebar}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 ml-auto"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1" aria-label={tr.app.navAriaLabel}>
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
              {fmt(tr.app.datasetFooter, {
                visible: filteredItems.length,
                deleted: deletedCount,
              })}
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
                {tr.app.systemSubtitle}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div
                role="group"
                aria-label={tr.app.languageGroupLabel}
                className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-0.5 shrink-0"
              >
                {LANGUAGE_OPTIONS.map((opt) => {
                  const active = lang === opt.code;
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => setLang(opt.code)}
                      aria-pressed={active}
                      title={opt.name}
                      className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-cyan-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                aria-label={tr.app.uploadAriaLabel}
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
                {tr.app.uploadBtn}
              </button>

              <button
                type="button"
                onClick={() => setIsDark((d) => !d)}
                aria-label={isDark ? tr.app.switchToLight : tr.app.switchToDark}
                title={isDark ? tr.app.switchToLight : tr.app.switchToDark}
                className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Global Multi-Filters & Deleted SAP Toggle */}
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-1.5">
            <div className="relative flex-1 min-w-[130px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                aria-label={tr.app.searchAriaLabel}
                placeholder={tr.app.searchPlaceholder}
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <select
              aria-label={tr.app.filterPep}
              value={filters.pep}
              onChange={(e) => setFilters((f) => ({ ...f, pep: e.target.value }))}
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white max-w-[140px]"
            >
              <option value="">{tr.app.allProjects}</option>
              {filterOptions.peps.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              aria-label={tr.app.filterAc}
              value={filters.atoConcessorio}
              onChange={(e) => setFilters((f) => ({ ...f, atoConcessorio: e.target.value }))}
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white max-w-[120px]"
            >
              <option value="">{tr.app.allAcs}</option>
              <option value="__MISSING__">{tr.app.missingAc}</option>
              {filterOptions.acs.map((ac) => (
                <option key={ac} value={ac}>
                  AC {ac}
                </option>
              ))}
            </select>

            <select
              aria-label={tr.app.filterSupplier}
              value={filters.supplier}
              onChange={(e) => setFilters((f) => ({ ...f, supplier: e.target.value }))}
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white max-w-[140px]"
            >
              <option value="">{tr.app.allSuppliers}</option>
              {filterOptions.suppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              aria-label={tr.app.filterNcm}
              value={filters.ncm}
              onChange={(e) => setFilters((f) => ({ ...f, ncm: e.target.value }))}
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white max-w-[120px]"
            >
              <option value="">{tr.app.allNcms}</option>
              {filterOptions.hasMissingNcm && <option value="__MISSING__">{tr.app.noNcm}</option>}
              {filterOptions.ncms.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <select
              aria-label={tr.app.filterBuyer}
              value={filters.buyer}
              onChange={(e) => setFilters((f) => ({ ...f, buyer: e.target.value }))}
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white max-w-[130px]"
            >
              <option value="">{tr.app.allBuyers}</option>
              {filterOptions.buyers.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <select
              aria-label={tr.app.filterStatus}
              value={filters.status}
              onChange={(e) => {
                const nextStatus = e.target.value;
                setFilters((f) => ({
                  ...f,
                  status: nextStatus,
                  hideDeleted: nextStatus === 'ITEM EXCLUIDO' ? false : f.hideDeleted,
                }));
              }}
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white max-w-[135px]"
            >
              <option value="">{tr.app.allStatus}</option>
              {filterOptions.statuses.map((st) => (
                <option key={st} value={st}>
                  {translateDeliveryStatus(st, lang)}
                </option>
              ))}
            </select>

            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <select
                aria-label={tr.app.dateBasisAriaLabel}
                title={tr.app.dateBasisTitle}
                value={filters.dateField}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, dateField: e.target.value as DateFilterBasis }))
                }
                className="py-1 pr-1 text-xs bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="OPS" className="bg-white dark:bg-slate-900">{tr.app.dateBasisOps}</option>
                <option value="PO" className="bg-white dark:bg-slate-900">{tr.app.dateBasisPo}</option>
                <option value="ETD" className="bg-white dark:bg-slate-900">{tr.app.dateBasisEtd}</option>
                <option value="ETA" className="bg-white dark:bg-slate-900">{tr.app.dateBasisEta}</option>
                <option value="DI" className="bg-white dark:bg-slate-900">{tr.app.dateBasisDi}</option>
                <option value="DELIVERY" className="bg-white dark:bg-slate-900">{tr.app.dateBasisDelivery}</option>
              </select>
              <span className="h-3.5 w-px bg-slate-300 dark:bg-slate-700" aria-hidden="true" />
              <select
                aria-label={tr.app.filterYear}
                value={filters.year}
                onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
                className="py-1 px-1 text-xs font-mono tabular-nums bg-transparent text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-white dark:bg-slate-900">{tr.app.allYears}</option>
                {filters.year && !availableYears.includes(filters.year) && (
                  <option value={filters.year} className="bg-white dark:bg-slate-900">
                    {filters.year}
                  </option>
                )}
                {availableYears.map((y) => (
                  <option key={y} value={y} className="bg-white dark:bg-slate-900">
                    {y}
                  </option>
                ))}
              </select>
              <span className="h-3.5 w-px bg-slate-300 dark:bg-slate-700" aria-hidden="true" />
              <select
                aria-label={tr.app.filterMonth}
                value={filters.month}
                onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))}
                className="py-1 pl-1 text-xs bg-transparent text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-white dark:bg-slate-900">{tr.app.allMonths}</option>
                {MONTH_KEYS.map((m) => (
                  <option key={m} value={m} className="bg-white dark:bg-slate-900">
                    {tr.months[m]}
                  </option>
                ))}
              </select>
            </div>

            <label className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0">
              <input
                type="checkbox"
                checked={filters.hideDeleted}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFilters((f) => ({
                    ...f,
                    hideDeleted: checked,
                    status: checked && f.status === 'ITEM EXCLUIDO' ? '' : f.status,
                  }));
                }}
                className="accent-cyan-600 rounded"
              />
              <span>{tr.app.hideDeleted}</span>
            </label>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                {tr.app.reset}
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
                  aria-label={tr.app.dismissError}
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
                  aria-label={tr.app.dismissMessage}
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
              activeNcmFilter={filters.ncm}
              hasActiveFilters={hasActiveFilters}
              onResetFilters={() => setFilters(DEFAULT_FILTERS)}
              onSelectProcess={(ref) => {
                setSelectedProcessRef(ref);
                setActiveTab('shipments');
              }}
              onFilterByNcm={(ncm) => {
                const nextVal = ncm === 'SEM NCM' ? '__MISSING__' : ncm;
                setFilters((f) => ({ ...f, ncm: f.ncm === nextVal ? '' : nextVal }));
              }}
            />
          )}

          {activeTab === 'comexCharts' && (
            <ComexChartsPanel
              items={filteredItems}
              processes={processes}
              onSelectProcess={(ref) => {
                setSelectedProcessRef(ref);
                setActiveTab('shipments');
              }}
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

          {activeTab === 'pqr' && (
            <PqrControlPanel
              items={filteredItems}
              kraljicOverrides={kraljicOverrides}
              onSaveKraljicOverride={handleSaveKraljicOverride}
              onSelectProcess={(ref) => {
                setSelectedProcessRef(ref);
                setActiveTab('shipments');
              }}
            />
          )}

          {activeTab === 'kraljic' && (
            <KraljicMatrixPanel
              items={filteredItems}
              kraljicOverrides={kraljicOverrides}
              onSaveKraljicOverride={handleSaveKraljicOverride}
              onSelectProcess={(ref) => {
                setSelectedProcessRef(ref);
                setActiveTab('shipments');
              }}
            />
          )}

          {activeTab === 'similar' && (
            <SimilarItemsPanel
              items={filteredItems}
              kraljicOverrides={kraljicOverrides}
              similarDecisions={similarDecisions}
              onSaveSimilarDecision={handleSaveSimilarDecision}
              onSaveKraljicOverride={handleSaveKraljicOverride}
              onSelectProcess={(ref) => {
                setSelectedProcessRef(ref);
                setActiveTab('shipments');
              }}
            />
          )}

          {activeTab === 'numerario' && (
            <NumerarioCostsPanel
              items={filteredItems}
              processes={processes}
              numerarioOverrides={numerarioOverrides}
              onSaveNumerarioOverride={handleSaveNumerarioOverride}
              onSelectProcess={(ref) => {
                setSelectedProcessRef(ref);
                setActiveTab('shipments');
              }}
            />
          )}

          {activeTab === 'worth' && (
            <ShipmentWorthinessPanel
              processes={processes}
              items={filteredItems}
              allItems={rawItems}
              onSelectProcess={(ref) => {
                setSelectedProcessRef(ref);
                setActiveTab('shipments');
              }}
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
                setFilters(DEFAULT_FILTERS);
                setSelectedProcessRef(null);
                setUploadedSourceLabel(null);
                setUploadBanner(tr.app.restoredSeedBanner);
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

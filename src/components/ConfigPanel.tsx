import { useRef, useState, useState as useLocalState } from 'react';
import { useConfig, DYConfig, DynamicBoostingFactor } from '../context/ConfigContext';
import { useRequestLog, RequestLogEntry } from '../context/RequestLogContext';
import { X, Terminal, Settings, Save, Database, RefreshCw, Globe, Cpu, Search, Layout, Codepen, Copy, Check, ImagePlus, ChevronDown, Plus, Trash2, Key, Eye, EyeOff, RefreshCcw, Wifi, Upload, Download } from 'lucide-react';
import { motion } from 'framer-motion';

const inputClassName = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-400';
const codeBlockClassName = 'rounded-xl border border-gray-800 bg-gray-900 text-gray-100';
const BENCHMARK_STORAGE_KEY = 'dy_benchmark_spec';

export const ConfigPanel = ({ onClose }: { onClose: () => void }) => {
  const { config, setConfig, lastRequestPayload, clearQueryCache } = useConfig();
  const { log: requestLog, loggedFetch, clearLog } = useRequestLog();
  const [localConfig, setLocalConfig] = useState<DYConfig>(config);
  const [activeTab, setActiveTab] = useState<'config' | 'payload' | 'network'>('config');
  const [copied, setCopied] = useState(false);
  const [showDynamicBoosting, setShowDynamicBoosting] = useState(false);
  const [showAffinityBoosting, setShowAffinityBoosting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<Array<{ id: number; name: string; strategy: string }>>([]);
  const [fetchingWidgets, setFetchingWidgets] = useState(false);
  const [widgetFetchError, setWidgetFetchError] = useState<string | null>(null);
  const importAllInputRef = useRef<HTMLInputElement | null>(null);

  const fetchWidgets = async () => {
    if (!localConfig.sectionId) {
      setWidgetFetchError('Section ID is required');
      return;
    }
    if (!localConfig.feedId) {
      setWidgetFetchError('Enter a Feed ID first, then fetch widgets');
      return;
    }
    setFetchingWidgets(true);
    setWidgetFetchError(null);
    try {
      const res = await loggedFetch(
        `${localConfig.sectionId?.startsWith('98') ? 'https://recs-worker.euc1.dynamicyield.com' : 'https://recs-worker.use1.dynamicyield.com'}/api/v1/section/${localConfig.sectionId}/feed/${localConfig.feedId}/widgets`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch widgets');
      setWidgets(data.widgets ?? []);
      if ((data.widgets ?? []).length === 0) setWidgetFetchError('No widgets found for this section/feed');
    } catch (e) {
      setWidgetFetchError(e instanceof Error ? e.message : String(e));
    } finally {
      setFetchingWidgets(false);
    }
  };

  const handleSave = () => {
    setConfig(localConfig);
    onClose();
  };

  const handleReset = () => {
    localStorage.removeItem('dy_sinsay_config');
    window.location.reload();
  };

  const handleCopyRequest = () => {
    if (lastRequestPayload) {
      navigator.clipboard.writeText(JSON.stringify(lastRequestPayload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const applyImportedConfig = (parsed: Partial<DYConfig>) => {
    const merged: DYConfig = {
      ...localConfig,
      ...parsed,
      mapping: {
        ...localConfig.mapping,
        ...(parsed.mapping || {}),
      },
      dynamicBoostingFactors: Array.isArray(parsed.dynamicBoostingFactors)
        ? parsed.dynamicBoostingFactors
        : localConfig.dynamicBoostingFactors,
      searchFilters: Array.isArray(parsed.searchFilters)
        ? parsed.searchFilters
        : localConfig.searchFilters,
      queryBoostRules: Array.isArray(parsed.queryBoostRules)
        ? parsed.queryBoostRules
        : localConfig.queryBoostRules,
    };

    setLocalConfig(merged);
    setConfig(merged);
    clearQueryCache();
  };

  const handleExportAllPreset = () => {
    let benchmarkSpec: unknown = null;
    const rawBenchmark = localStorage.getItem(BENCHMARK_STORAGE_KEY);
    if (rawBenchmark) {
      try {
        benchmarkSpec = JSON.parse(rawBenchmark);
      } catch {
        benchmarkSpec = null;
      }
    }

    const payload = {
      _meta: {
        exportedAt: new Date().toISOString(),
        source: 'lpp-search',
        version: 1,
        type: 'all-preset',
      },
      appConfig: localConfig,
      benchmarkSpec,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    anchor.href = url;
    anchor.download = `dy-all-preset-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    setSettingsStatus('All preset exported');
    setTimeout(() => setSettingsStatus(null), 2500);
  };

  const handleImportAllPreset = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        appConfig?: Partial<DYConfig>;
        benchmarkSpec?: unknown;
      };

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid JSON file');
      }

      if (!parsed.appConfig || typeof parsed.appConfig !== 'object') {
        throw new Error('Missing "appConfig" object');
      }

      applyImportedConfig(parsed.appConfig);

      if (parsed.benchmarkSpec && typeof parsed.benchmarkSpec === 'object') {
        localStorage.setItem(BENCHMARK_STORAGE_KEY, JSON.stringify(parsed.benchmarkSpec, null, 2));
      }

      setSettingsStatus('All preset imported and applied');
      setTimeout(() => setSettingsStatus(null), 3000);
    } catch (error) {
      setSettingsStatus(error instanceof Error ? `Import failed: ${error.message}` : 'Import failed');
      setTimeout(() => setSettingsStatus(null), 3500);
    }
  };

  const updateField = (field: keyof DYConfig, value: any) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  const addDynamicBoostingFactor = () => {
    const next: DynamicBoostingFactor[] = [
      ...(localConfig.dynamicBoostingFactors || []),
      {
        field: '',
        value: '',
        matchType: 'IS',
        weight: 0,
      },
    ];
    updateField('dynamicBoostingFactors', next);
  };

  const removeDynamicBoostingFactor = (idx: number) => {
    const next = (localConfig.dynamicBoostingFactors || []).filter((_, factorIdx) => factorIdx !== idx);
    updateField('dynamicBoostingFactors', next);
  };

  const updateDynamicBoostingFactor = (
    idx: number,
    field: keyof DynamicBoostingFactor,
    value: string | number
  ) => {
    const next = (localConfig.dynamicBoostingFactors || []).map((factor, factorIdx) => {
      if (factorIdx !== idx) {
        return factor;
      }

      if (field === 'weight') {
        const numeric = typeof value === 'number' ? value : Number(value);
        return { ...factor, weight: Math.max(-100, Math.min(100, Number.isNaN(numeric) ? 0 : numeric)) };
      }

      return { ...factor, [field]: value };
    });

    updateField('dynamicBoostingFactors', next);
  };

  const handleLogoUpload = (file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateField('logoUrl', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const tabClassName = (tab: 'config' | 'payload' | 'network') =>
    `inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
      activeTab === tab
        ? 'bg-indigo-50 text-indigo-700 shadow-sm'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  return (
    <div className="fixed inset-0 z-100 flex justify-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-gray-200 bg-[#f8f8f8] text-gray-900 shadow-2xl"
      >
        <div className="border-b border-gray-200 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Settings size={20} />
                </div>
                <div>
                  <span className="hidden" aria-hidden="true">
                    <Terminal size={0} />
                  </span>
                  <h2 className="text-lg font-semibold text-gray-900">DY Search Settings</h2>
                  <p className="mt-0.5 text-sm text-gray-500">Configure search, inspect payloads, and review network traffic.</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => setActiveTab('config')} className={tabClassName('config')}>
                  Configuration
                </button>
                <button type="button" onClick={() => setActiveTab('payload')} className={tabClassName('payload')}>
                  Request Inspector
                </button>
                <button type="button" onClick={() => setActiveTab('network')} className={tabClassName('network')}>
                  <Wifi size={14} />
                  Network
                  {requestLog.length > 0 && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                      {requestLog.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
          {activeTab === 'config' ? (
            <div className="space-y-8 pb-6">
              <section>
                <SectionHeader icon={<Key size={14} />} title="API Keys & Branding" />
                <div className="space-y-4">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <label className="text-[11px] font-medium text-gray-700">Experience API Key</label>
                      <span className="text-[11px] text-gray-500">Used for Visual Search &amp; Shopping Muse</span>
                    </div>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        className={`${inputClassName} pr-10`}
                        value={localConfig.experienceApiKey}
                        placeholder="Enter Experience API Key..."
                        onChange={e => updateField('experienceApiKey', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-700"
                        tabIndex={-1}
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <ConfigField
                      label="Logo URL"
                      value={localConfig.logoUrl}
                      onChange={(v: string) => updateField('logoUrl', v)}
                      description="URL or data URI"
                    />
                    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50">
                      <ImagePlus size={14} className="text-indigo-600" />
                      Upload Logo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleLogoUpload(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                </div>
              </section>

              <section>
                <SectionHeader icon={<Database size={14} />} title="Core API Resolution" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ConfigField label="Section ID" value={localConfig.sectionId} onChange={(v: string) => updateField('sectionId', v)} />
                  <ConfigField
                    label="Feed ID"
                    value={localConfig.feedId}
                    onChange={(v: string) => updateField('feedId', v)}
                    description="Required — find in DY UI → Assets → Feeds"
                  />

                  <div className="sm:col-span-2">
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <label className="text-[11px] font-medium text-gray-700">Widget ID</label>
                      <button
                        type="button"
                        onClick={fetchWidgets}
                        disabled={fetchingWidgets}
                        className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700 disabled:opacity-40"
                      >
                        <RefreshCcw size={14} className={fetchingWidgets ? 'animate-spin' : ''} />
                        {fetchingWidgets ? 'Fetching…' : 'Fetch from API'}
                      </button>
                    </div>

                    {widgets.length > 0 ? (
                      <select
                        value={localConfig.widgetId}
                        onChange={e => updateField('widgetId', e.target.value)}
                        className={inputClassName}
                      >
                        <option value="">— select a widget —</option>
                        {widgets.map(w => {
                          let strategyKey = w.name;
                          try { strategyKey = JSON.parse(w.strategy)?.key ?? w.name; } catch {}
                          return <option key={w.id} value={String(w.id)}>{w.name} ({strategyKey})</option>;
                        })}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className={inputClassName}
                        value={localConfig.widgetId}
                        onChange={e => updateField('widgetId', e.target.value)}
                      />
                    )}

                    {widgetFetchError && <p className="mt-2 text-sm text-red-600">{widgetFetchError}</p>}
                    <p className="mt-2 text-[11px] text-gray-500">Optional — leave blank to use request parameters directly. Widgets pre-configure strategy, filters &amp; ranking.</p>
                  </div>
                </div>
              </section>

              <section>
                <SectionHeader icon={<Search size={14} />} title="Search & Strategy" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ConfigField label="Strategy" value={localConfig.strategy} onChange={(v: string) => updateField('strategy', v)} />
                  <ConfigField label="Max Products" type="number" value={localConfig.maxProducts} onChange={(v: string) => updateField('maxProducts', parseInt(v))} />
                  <ConfigField label="Items Per Page" type="number" value={localConfig.itemsPerPage} onChange={(v: string) => updateField('itemsPerPage', parseInt(v))} />

                  <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 sm:col-span-2">
                    <Toggle label="Bucket Size" checked={localConfig.useBucketSize} onChange={(v: boolean) => updateField('useBucketSize', v)} />
                    {localConfig.useBucketSize && (
                      <input
                        type="number"
                        value={localConfig.bucketSize}
                        onChange={(e) => updateField('bucketSize', parseInt(e.target.value))}
                        className={inputClassName}
                      />
                    )}
                  </div>

                  <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 sm:col-span-2">
                    <Toggle label="Search Formula" checked={localConfig.useSearchFormula} onChange={(v: boolean) => updateField('useSearchFormula', v)} />
                    {localConfig.useSearchFormula && (
                      <input
                        type="text"
                        value={localConfig.searchFormula}
                        onChange={(e) => updateField('searchFormula', e.target.value)}
                        className={inputClassName}
                      />
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-xl border border-gray-200 bg-white p-4 sm:col-span-2">
                    <Toggle label="Suggest Mode" checked={localConfig.suggestMode} onChange={(v: boolean) => updateField('suggestMode', v)} />
                    <Toggle label="Explain Mode" checked={localConfig.explainMode} onChange={(v: boolean) => updateField('explainMode', v)} />
                    <Toggle label="Translation" checked={localConfig.translationEnabled} onChange={(v: boolean) => updateField('translationEnabled', v)} />
                    <Toggle label="PLP Mode" checked={localConfig.plpSearchMode} onChange={(v: boolean) => updateField('plpSearchMode', v)} />
                    <Toggle label="Sort by Popularity" checked={localConfig.sortByEnabled} onChange={(v: boolean) => updateField('sortByEnabled', v)} />
                  </div>
                </div>
              </section>

              <section>
                <SectionHeader icon={<Cpu size={14} />} title="Semantic & KNN Parameters" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ConfigField label="K (Neighbors)" type="number" value={localConfig.k} onChange={(v: string) => updateField('k', parseInt(v))} />
                  <ConfigField label="Num Candidates" type="number" value={localConfig.numCandidates} onChange={(v: string) => updateField('numCandidates', parseInt(v))} />
                  <ConfigField label="Text KNN Threshold" type="number" step="0.01" value={localConfig.textKnnThreshold} onChange={(v: string) => updateField('textKnnThreshold', parseFloat(v))} />
                  <ConfigField label="Image KNN Threshold" type="number" step="0.01" value={localConfig.imageKnnThreshold} onChange={(v: string) => updateField('imageKnnThreshold', parseFloat(v))} />
                  <ConfigField label="Image Boost" type="number" step="0.1" value={localConfig.imageBoost} onChange={(v: string) => updateField('imageBoost', parseFloat(v))} />
                </div>
              </section>

              <section>
                <SectionHeader icon={<Globe size={14} />} title="Localization & Environment" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ConfigField label="Context Type (type)" value={localConfig.ctxType} onChange={(v: string) => updateField('ctxType', v)} description="e.g. HOMEPAGE" />
                  <ConfigField label="Language (lng)" value={localConfig.language} onChange={(v: string) => updateField('language', v)} />

                  <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 sm:col-span-2">
                    <Toggle label="Locale" checked={localConfig.useLocale} onChange={(v: boolean) => updateField('useLocale', v)} />
                    {localConfig.useLocale && (
                      <input
                        type="text"
                        value={localConfig.locale}
                        onChange={(e) => updateField('locale', e.target.value)}
                        className={inputClassName}
                      />
                    )}
                  </div>

                  <ConfigField label="Geo Code" value={localConfig.geoCode} onChange={(v: string) => updateField('geoCode', v)} />
                  <ConfigField label="Geo Region" value={localConfig.geoRegionCode} onChange={(v: string) => updateField('geoRegionCode', v)} />
                  <ConfigField label="Visitor ID (uid)" value={localConfig.uid} onChange={(v: string) => updateField('uid', v)} className="sm:col-span-2" />
                  <ConfigField label="Currency" value={localConfig.currency} onChange={(v: string) => updateField('currency', v.toUpperCase())} />
                  <ConfigField
                    label="Category Path"
                    value={localConfig.categoryPath}
                    onChange={(v: string) => updateField('categoryPath', v)}
                    description="Format: Sinsay / Women / Search"
                    className="sm:col-span-2"
                  />
                </div>
              </section>

              <section>
                <SectionHeader icon={<Layout size={14} />} title="Field Priority Mapping" />
                <div className="space-y-4">
                  <ConfigField
                    label="Title (priority list)"
                    value={localConfig.mapping.title.join(', ')}
                    onChange={(v: string) => setLocalConfig({ ...localConfig, mapping: { ...localConfig.mapping, title: v.split(',').map((s: string) => s.trim()) } })}
                  />
                  <ConfigField
                    label="Images (priority list)"
                    value={localConfig.mapping.image.join(', ')}
                    onChange={(v: string) => setLocalConfig({ ...localConfig, mapping: { ...localConfig.mapping, image: v.split(',').map((s: string) => s.trim()) } })}
                  />
                  <ConfigField
                    label="Price (priority list)"
                    value={localConfig.mapping.price.join(', ')}
                    onChange={(v: string) => setLocalConfig({ ...localConfig, mapping: { ...localConfig.mapping, price: v.split(',').map((s: string) => s.trim()) } })}
                  />
                </div>
              </section>

              <section>
                <SectionHeader icon={<Search size={14} />} title="Priority Boosting" />
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setShowDynamicBoosting((prev) => !prev)}
                      className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left"
                    >
                      <span className="text-sm font-medium text-gray-800">Dynamic Attribute Boosting</span>
                      <ChevronDown size={16} className={`text-gray-500 transition-transform ${showDynamicBoosting ? 'rotate-180' : ''}`} />
                    </button>

                    {showDynamicBoosting ? (
                      <div className="space-y-4 border-t border-gray-200 px-4 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <Toggle
                            label="Enable Dynamic Boosting"
                            checked={localConfig.useDynamicBoosting}
                            onChange={(v: boolean) => updateField('useDynamicBoosting', v)}
                          />
                          <button
                            type="button"
                            onClick={addDynamicBoostingFactor}
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50"
                          >
                            <Plus size={14} /> Add Filter
                          </button>
                        </div>

                        <p
                          className="text-sm text-gray-500"
                          title="Boosts products where a specific attribute matches a value. matchType options: IS (exact match), CONTAINS (substring), IS_NOT (exclusion). weight range: -100-100. Higher = stronger boost."
                        >
                          Boosts products where a specific attribute matches a value.
                        </p>

                        {(localConfig.dynamicBoostingFactors || []).map((factor, idx) => (
                          <div key={`dynamic-factor-${idx}`} className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <ConfigField
                                label="Field"
                                value={factor.field}
                                onChange={(v: string) => updateDynamicBoostingFactor(idx, 'field', v)}
                              />
                              <ConfigField
                                label="Value"
                                value={factor.value}
                                onChange={(v: string) => updateDynamicBoostingFactor(idx, 'value', v)}
                              />
                              <div>
                                <div className="mb-1.5 flex items-center justify-between gap-3">
                                  <label className="text-[11px] font-medium text-gray-700">Match Type</label>
                                </div>
                                <select
                                  value={factor.matchType}
                                  onChange={(e) => updateDynamicBoostingFactor(idx, 'matchType', e.target.value)}
                                  className={inputClassName}
                                >
                                  <option value="IS">IS</option>
                                  <option value="CONTAINS">CONTAINS</option>
                                  <option value="IS_NOT">IS_NOT</option>
                                </select>
                              </div>
                              <ConfigField
                                label="Weight (-100 to 100)"
                                type="number"
                                value={factor.weight}
                                onChange={(v: string) => updateDynamicBoostingFactor(idx, 'weight', Number(v))}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeDynamicBoostingFactor(idx)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                            >
                              <Trash2 size={14} /> Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setShowAffinityBoosting((prev) => !prev)}
                      className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left"
                    >
                      <span className="text-sm font-medium text-gray-800">Affinity Boosting</span>
                      <ChevronDown size={16} className={`text-gray-500 transition-transform ${showAffinityBoosting ? 'rotate-180' : ''}`} />
                    </button>

                    {showAffinityBoosting ? (
                      <div className="space-y-4 border-t border-gray-200 px-4 py-4">
                        <Toggle
                          label="Enable Affinity Boosting"
                          checked={localConfig.useAffinityBoosting}
                          onChange={(v: boolean) => updateField('useAffinityBoosting', v)}
                        />

                        <ConfigField
                          label="Affinity Weight (-100 to 100)"
                          type="number"
                          value={localConfig.affinityBoostWeight}
                          onChange={(v: string) => updateField('affinityBoostWeight', Math.max(-100, Math.min(100, Number(v) || 0)))}
                        />

                        <div>
                          <div className="mb-1.5 flex items-center justify-between gap-3">
                            <label className="text-[11px] font-medium text-gray-700">Affinity Profile JSON</label>
                          </div>
                          <textarea
                            value={localConfig.affinityProfileJson}
                            onChange={(e) => updateField('affinityProfileJson', e.target.value)}
                            rows={8}
                            className={`${inputClassName} resize-y`}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
          ) : activeTab === 'payload' ? (
            <div className="space-y-6 pb-6">
              <div className="flex items-center justify-between gap-4">
                <SectionHeader icon={<Codepen size={14} />} title="Final Request Payload" />
                {lastRequestPayload && (
                  <button
                    type="button"
                    onClick={handleCopyRequest}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      copied
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy Payload'}
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-500">Copy-paste this payload into API clients for direct testing.</p>
              <div className={`${codeBlockClassName} overflow-x-auto p-4`}>
                <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-6 text-gray-100">
                  {lastRequestPayload ? JSON.stringify(lastRequestPayload, null, 2) : '// No request captured yet. Perform a search first.'}
                </pre>
              </div>
            </div>
          ) : (
            <NetworkTab log={requestLog} onClear={clearLog} />
          )}
        </div>

        {activeTab === 'config' && (
          <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4">
            {settingsStatus && (
              <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
                {settingsStatus}
              </div>
            )}
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleExportAllPreset}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                <Download size={16} /> Export All Preset
              </button>
              <button
                type="button"
                onClick={() => importAllInputRef.current?.click()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                <Upload size={16} /> Import All Preset
              </button>
              <input
                ref={importAllInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  handleImportAllPreset(e.target.files?.[0] ?? null);
                  e.currentTarget.value = '';
                }}
              />

            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                <Save size={16} /> Save
              </button>
              <button
                type="button"
                onClick={() => {
                  clearQueryCache();
                  setCacheCleared(true);
                  setTimeout(() => setCacheCleared(false), 2000);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100"
              >
                <RefreshCcw size={16} /> {cacheCleared ? 'Cache Cleared ✓' : 'Clear Cache'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
              >
                <RefreshCw size={16} /> Factory Reset
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const SectionHeader = ({ icon, title }: any) => (
  <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
    <span className="text-gray-400">{icon}</span>
    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
  </div>
);

const ConfigField = ({ label, value, onChange, description, type = 'text', step, className = '' }: any) => (
  <div className={className}>
    <div className="mb-1.5 flex items-center justify-between gap-3">
      {label ? (
        <label className="text-[11px] font-medium text-gray-700">{label}</label>
      ) : (
        <span className="h-[17px]" />
      )}
      {description && <span className="text-[11px] text-gray-500">{description}</span>}
    </div>
    <input
      type={type}
      step={step}
      className={inputClassName}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const Toggle = ({ label, checked, onChange }: any) => (
  <div className="flex items-center gap-3">
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-gray-300'}`}
      aria-pressed={checked}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
    <span className="text-sm font-medium text-gray-700">{label}</span>
  </div>
);

const getStatusBadgeClassName = (status?: number | null, hasError?: boolean) => {
  if (hasError || (status != null && status >= 400)) {
    return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200';
  }

  if (status != null && status >= 200) {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200';
  }

  return 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200';
};

const NetworkTab = ({ log, onClear }: { log: RequestLogEntry[]; onClear: () => void }) => {
  const [selected, setSelected] = useLocalState<string | null>(log[0]?.id ?? null);
  const entry = log.find(e => e.id === selected) ?? log[0] ?? null;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="flex items-center justify-between gap-4">
        <SectionHeader icon={<Wifi size={14} />} title="Network Log" />
        {log.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-medium text-red-600 transition-colors hover:text-red-700"
          >
            Clear
          </button>
        )}
      </div>

      {log.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500">
          No requests yet. Perform a search to see traffic.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="grid grid-cols-[52px_72px_64px_minmax(0,1fr)] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <span>#</span>
              <span>Status</span>
              <span>Method</span>
              <span>Request</span>
            </div>
            <div className="max-h-64 overflow-y-auto custom-scrollbar">
              {log.map((e, i) => (
                <button
                  type="button"
                  key={e.id}
                  onClick={() => setSelected(e.id)}
                  className={`grid w-full grid-cols-[52px_72px_64px_minmax(0,1fr)] gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0 ${selected === e.id ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="space-y-1 text-xs text-gray-500">
                    <div>#{log.length - i}</div>
                    <div>{e.timestamp.toLocaleTimeString()}</div>
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClassName(e.status, !!e.error)}`}>
                      {e.status ?? '…'}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-gray-700">{e.method}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-gray-800">{e.url}</div>
                    <div className="mt-1 text-xs text-gray-500">{e.durationMs != null ? `${e.durationMs}ms` : 'Pending'}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {entry && (
            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
              {entry.upstream ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-gray-600">DY API</span>
                  <span className="font-semibold text-gray-800">POST</span>
                  <span className="min-w-0 flex-1 truncate">{entry.upstream.url}</span>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClassName(entry.upstream.status, false)}`}>
                    {entry.upstream.status} {entry.upstream.statusText}
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <span className="font-semibold text-gray-800">{entry.method}</span>
                  <span className="min-w-0 flex-1 truncate">{entry.url}</span>
                  {entry.status != null && (
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClassName(entry.status, !!entry.error)}`}>
                      {entry.status} {entry.statusText}
                    </span>
                  )}
                  {entry.durationMs != null && <span className="text-xs text-gray-500">{entry.durationMs}ms</span>}
                </div>
              )}

              <div className="space-y-3">
                {entry.upstream ? (
                  <>
                    <DetailPane label="request" content={entry.upstream.requestBody} isError={false} />
                    <DetailPane label="response" content={entry.responseBody} isError={!!entry.error} />
                    <DetailPane label="headers" content={entry.upstream.headers} isError={false} collapsed />
                  </>
                ) : (
                  <>
                    <DetailPane label="request" content={entry.requestBody} isError={false} />
                    <DetailPane label="response" content={entry.error ?? entry.responseBody} isError={!!entry.error} />
                    <DetailPane label="headers" content={Object.keys(entry.responseHeaders).length > 0 ? entry.responseHeaders : null} isError={false} collapsed />
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const DetailPane = ({ label, content, isError, collapsed }: { label: 'request' | 'response' | 'headers'; content: unknown; isError: boolean; collapsed?: boolean }) => {
  const [open, setOpen] = useLocalState(!collapsed);
  const isEmpty = content == null;
  const title = label === 'request' ? 'Request Body' : label === 'headers' ? 'Response Headers' : 'Response Body';

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
      >
        {title}
        <ChevronDown size={16} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-gray-200 bg-gray-900 p-4 overflow-x-auto custom-scrollbar max-h-72">
          {isEmpty ? (
            <span className="font-mono text-xs text-gray-500">—</span>
          ) : (
            <pre className={`whitespace-pre-wrap break-all font-mono text-xs leading-6 ${isError ? 'text-red-300' : label === 'headers' ? 'text-gray-300' : 'text-gray-100'}`}>
              {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

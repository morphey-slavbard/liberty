import React, { useState, useCallback, useRef } from 'react';
import { useConfig } from '../context/ConfigContext';
import { runBenchmark, type BenchmarkRun, type BenchmarkSpec, type QueryBoostRule } from '../utils/benchmarkRunner';
import { downloadReport } from '../utils/benchmarkReport';
import { Download, Play, AlertCircle, ChevronDown, ChevronUp, ArrowLeft, Plus, Trash2, Copy, Upload } from 'lucide-react';

// ─── Default config stored in localStorage ───────────────────────────────────

const STORAGE_KEY = 'dy_benchmark_spec';

const DEFAULT_SPEC: BenchmarkSpec = {
  queries: [
    'sukienka',
    'klapki',
    'spodenki',
    'top',
    'pizama damska',
    'spodenki damskie',
    'spodnie',
    'pizama',
    'szorty',
    'klapki damskie',
    'spodnica',
    'stroj kapielowy',
    'sukienka damska',
    'spodnie damskie',
    'kolarki',
    'torebka',
    'szorty damskie',
    'koszula',
    'posciel',
    'dywan',
    'akcesoria szkolne pusheen',
    'sukienka w kwiaty na wieczór koktajlowy',
    'Styl nordycki',
    'Wełna bluza',
    'akcesoria plażowe',
    {
      text: 'bluza',
      affinityProfiles: [
        { name: 'czerwony', profile: { color: { czerwony: 1000 } } },
        { name: 'niebieski', profile: { color: { niebieski: 1000 } } },
      ],
    },
  ],
  queryBoostRules: [
    {
      query: 'sukienka',
      field: 'season',
      value: '2026',
      matchType: 'CONTAINS',
      weight: 50,
    },
  ],
  itemsToShow: 6,
  configurations: [
    {
      name: 'Baseline',
      description: 'Default settings — all override keys shown for reference',
      overrides: {
        // Search behaviour
        strategy: 'SEMANTIC_SEARCH',   // 'SEMANTIC_SEARCH' | 'KEYWORD_SEARCH'
        suggestMode: true,
        translationEnabled: false,
        plpSearchMode: false,
        explainMode: false,
        sortByEnabled: false,

        // KNN / retrieval
        k: 100,
        numCandidates: 500,
        imageBoost: 0.5,
        imageKnnThreshold: 0.8,
        textKnnThreshold: 0.7,

        // Results
        itemsPerPage: 12,
        maxProducts: 1000,

        // Bucket size (optional)
        useBucketSize: false,
        bucketSize: 10,

        // Search formula (optional)
        useSearchFormula: false,
        searchFormula: '',

        // Locale (optional)
        useLocale: false,
        locale: 'en_US',

        // Affinity boosting (optional — or use per-query affinityProfiles instead)
        useAffinityBoosting: false,
        affinityBoostWeight: 80,

        // Dynamic boosting (optional)
        useDynamicBoosting: false,
        dynamicBoostingFactors: [
          { field: 'categories', value: 'example', matchType: 'IS', weight: 50 },
        ],

        // Context
        language: 'pl_PL',
        ctxType: 'HOMEPAGE',
        geoCode: 'PL',
        geoRegionCode: 'PL',
      },
    },
    {
      name: 'Translation + High Candidates',
      description: 'Translation enabled, more KNN candidates for better recall',
      overrides: {
        translationEnabled: true,
        numCandidates: 1000,
        k: 200,
        language: 'pl_PL',
        geoCode: 'PL',
        geoRegionCode: 'PL',
      },
    },
  ],
};

function loadSpec(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ?? JSON.stringify(DEFAULT_SPEC, null, 2);
  } catch {
    return JSON.stringify(DEFAULT_SPEC, null, 2);
  }
}

function normalizeSpecShape(spec: BenchmarkSpec): BenchmarkSpec {
  return {
    ...spec,
    queryBoostRules: Array.isArray(spec.queryBoostRules) ? spec.queryBoostRules : [],
    searchFilters: Array.isArray(spec.searchFilters) ? spec.searchFilters : [],
  };
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function timingClass(ms: number): string {
  if (ms < 500) return 'text-green-600 border-green-400';
  if (ms < 2000) return 'text-amber-600 border-amber-400';
  return 'text-red-600 border-red-400';
}

function statusClass(code: number | null): string {
  if (code === null) return 'text-gray-500 border-gray-300';
  if (code >= 200 && code < 300) return 'text-green-600 border-green-400';
  if (code >= 400 && code < 500) return 'text-amber-600 border-amber-400';
  return 'text-red-600 border-red-400';
}

// ─── Components: QueryBoostingTab & SearchFiltersTab ─────────────────────────

const SearchFiltersTab: React.FC<{
  parsedSpec: BenchmarkSpec | null;
  onChange: (updater: (spec: BenchmarkSpec) => BenchmarkSpec) => void;
}> = ({ parsedSpec, onChange }) => {
  if (!parsedSpec) {
    return (
      <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
        Fix JSON first. Then filter table work.
      </div>
    );
  }

  const filters = parsedSpec.searchFilters || [];

  const updateFilter = (
    index: number,
    field: 'field' | 'values' | 'min' | 'max',
    value: string | string[] | number | undefined,
  ) => {
    onChange((spec) => ({
      ...spec,
      searchFilters: (spec.searchFilters || []).map((filter, filterIndex) => {
        if (filterIndex !== index) return filter;
        if (field === 'field') {
          return { ...filter, field: value as string };
        } else if (field === 'values') {
          return { ...filter, values: (value as string[]) || [] };
        } else if (field === 'min' || field === 'max') {
          return { ...filter, [field]: value === '' ? undefined : Number(value) || undefined };
        }
        return filter;
      }),
    }));
  };

  const addFilter = () => {
    onChange((spec) => ({
      ...spec,
      searchFilters: [...(spec.searchFilters || []), { field: '', values: [] }],
    }));
  };

  const removeFilter = (index: number) => {
    onChange((spec) => ({
      ...spec,
      searchFilters: (spec.searchFilters || []).filter((_, filterIndex) => filterIndex !== index),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[12px] text-gray-500">
          Add search filters to all requests. Format: field with values[] OR min/max range.
        </p>
        <button
          onClick={addFilter}
          className="flex items-center gap-2 px-3 py-2 bg-black text-white text-[11px] font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
        >
          <Plus size={12} /> Add Filter
        </button>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-sm">
        <table className="w-full border-collapse min-w-[900px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest border-b border-r border-gray-200">Field</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest border-b border-r border-gray-200">Values (csv)</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest border-b border-r border-gray-200">Min</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest border-b border-r border-gray-200">Max</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest border-b border-gray-200">Action</th>
            </tr>
          </thead>
          <tbody>
            {filters.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[12px] text-gray-400">
                  No search filters yet.
                </td>
              </tr>
            ) : (
              filters.map((filter, index) => (
                <tr key={index}>
                  <td className="px-3 py-2 border-b border-r border-gray-100">
                    <input
                      value={filter.field}
                      onChange={(e) => updateFilter(index, 'field', e.target.value)}
                      className="w-full border border-gray-200 rounded-sm px-2 py-1.5 text-[12px] outline-none focus:border-black"
                      placeholder="color"
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-r border-gray-100">
                    <input
                      value={(filter.values || []).join(', ')}
                      onChange={(e) => updateFilter(index, 'values', e.target.value.split(',').map((v) => v.trim()).filter(Boolean))}
                      className="w-full border border-gray-200 rounded-sm px-2 py-1.5 text-[12px] outline-none focus:border-black"
                      placeholder="red, blue, green"
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-r border-gray-100">
                    <input
                      type="number"
                      value={filter.min ?? ''}
                      onChange={(e) => updateFilter(index, 'min', e.target.value)}
                      className="w-full border border-gray-200 rounded-sm px-2 py-1.5 text-[12px] outline-none focus:border-black"
                      placeholder="20"
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-r border-gray-100">
                    <input
                      type="number"
                      value={filter.max ?? ''}
                      onChange={(e) => updateFilter(index, 'max', e.target.value)}
                      className="w-full border border-gray-200 rounded-sm px-2 py-1.5 text-[12px] outline-none focus:border-black"
                      placeholder="200"
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-gray-100">
                    <button
                      onClick={() => removeFilter(index)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-widest border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TabButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest border transition-colors ${
      active ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-500 hover:text-black hover:border-gray-300'
    }`}
  >
    {label}
  </button>
);

const EMPTY_BOOST_RULE: QueryBoostRule = {
  query: '',
  field: '',
  value: '',
  matchType: 'CONTAINS',
  weight: 50,
};

const QueryBoostingTab: React.FC<{
  parsedSpec: BenchmarkSpec | null;
  onChange: (updater: (spec: BenchmarkSpec) => BenchmarkSpec) => void;
}> = ({ parsedSpec, onChange }) => {
  if (!parsedSpec) {
    return (
      <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
        Fix JSON first. Then boost table work.
      </div>
    );
  }

  const boostRules = parsedSpec.queryBoostRules || [];

  const updateRule = (index: number, field: keyof QueryBoostRule, value: string | number) => {
    onChange((spec) => ({
      ...spec,
      queryBoostRules: (spec.queryBoostRules || []).map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, [field]: field === 'weight' ? Number(value) || 0 : value } : rule,
      ),
    }));
  };

  const addRule = () => {
    onChange((spec) => ({
      ...spec,
      queryBoostRules: [...(spec.queryBoostRules || []), { ...EMPTY_BOOST_RULE }],
    }));
  };

  const removeRule = (index: number) => {
    onChange((spec) => ({
      ...spec,
      queryBoostRules: (spec.queryBoostRules || []).filter((_, ruleIndex) => ruleIndex !== index),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[12px] text-gray-500">
          Add query-specific boost rules. Applied to all requests where the query text matches.
        </p>
        <button
          onClick={addRule}
          className="flex items-center gap-2 px-3 py-2 bg-black text-white text-[11px] font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
        >
          <Plus size={12} /> Add Rule
        </button>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-sm">
        <table className="w-full border-collapse min-w-[1200px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest border-b border-r border-gray-200">Query</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest border-b border-r border-gray-200">Field</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest border-b border-r border-gray-200">Value</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest border-b border-r border-gray-200">Match Type</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest border-b border-r border-gray-200">Weight</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest border-b border-gray-200">Action</th>
            </tr>
          </thead>
          <tbody>
            {boostRules.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[12px] text-gray-400">
                  No boost rules yet.
                </td>
              </tr>
            ) : (
              boostRules.map((rule, index) => (
                <tr key={index}>
                  <td className="px-3 py-2 border-b border-r border-gray-100">
                    <input
                      value={rule.query}
                      onChange={(e) => updateRule(index, 'query', e.target.value)}
                      className="w-full border border-gray-200 rounded-sm px-2 py-1.5 text-[12px] outline-none focus:border-black"
                      placeholder="sukienka"
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-r border-gray-100">
                    <input
                      value={rule.field}
                      onChange={(e) => updateRule(index, 'field', e.target.value)}
                      className="w-full border border-gray-200 rounded-sm px-2 py-1.5 text-[12px] outline-none focus:border-black"
                      placeholder="season"
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-r border-gray-100">
                    <input
                      value={rule.value}
                      onChange={(e) => updateRule(index, 'value', e.target.value)}
                      className="w-full border border-gray-200 rounded-sm px-2 py-1.5 text-[12px] outline-none focus:border-black"
                      placeholder="2026"
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-r border-gray-100">
                    <select
                      value={rule.matchType}
                      onChange={(e) => updateRule(index, 'matchType', e.target.value)}
                      className="w-full border border-gray-200 rounded-sm px-2 py-1.5 text-[12px] outline-none focus:border-black bg-white"
                    >
                      <option value="CONTAINS">CONTAINS</option>
                      <option value="IS">IS</option>
                      <option value="STARTS_WITH">STARTS_WITH</option>
                      <option value="ENDS_WITH">ENDS_WITH</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 border-b border-r border-gray-100">
                    <input
                      type="number"
                      value={rule.weight}
                      onChange={(e) => updateRule(index, 'weight', e.target.value)}
                      className="w-full border border-gray-200 rounded-sm px-2 py-1.5 text-[12px] outline-none focus:border-black"
                      placeholder="50"
                      min="-100"
                      max="100"
                    />
                  </td>
                  <td className="px-3 py-2 border-b border-gray-100">
                    <button
                      onClick={() => removeRule(index)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-widest border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── BenchmarkPage ────────────────────────────────────────────────────────────

export const BenchmarkPage: React.FC = () => {
  const { config, syncFiltersFromBenchmark, syncBoostRulesFromBenchmark } = useConfig();

  const [specJson, setSpecJson] = useState<string>(loadSpec);
  const [activeTab, setActiveTab] = useState<'json' | 'boosts' | 'filters'>('json');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number; label: string } | null>(null);
  const [result, setResult] = useState<BenchmarkRun | null>(null);
  const [expandedConfigs, setExpandedConfigs] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const importRulesInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef(false);

  // Persist JSON edits to localStorage
  const handleJsonChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setSpecJson(val);
    try {
      normalizeSpecShape(JSON.parse(val) as BenchmarkSpec);
      setJsonError(null);
      localStorage.setItem(STORAGE_KEY, val);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }, []);

  const updateSpec = useCallback((updater: (spec: BenchmarkSpec) => BenchmarkSpec) => {
    try {
      const nextSpec = normalizeSpecShape(updater(normalizeSpecShape(JSON.parse(specJson) as BenchmarkSpec)));
      const nextJson = JSON.stringify(nextSpec, null, 2);
      setSpecJson(nextJson);
      setJsonError(null);
      localStorage.setItem(STORAGE_KEY, nextJson);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }, [specJson]);

  const handleRun = useCallback(async () => {
    let spec: BenchmarkSpec;
    try {
      spec = normalizeSpecShape(JSON.parse(specJson) as BenchmarkSpec);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON');
      return;
    }

    if (!Array.isArray(spec.queries) || spec.queries.length === 0) {
      setJsonError('"queries" must be a non-empty array');
      return;
    }
    if (!Array.isArray(spec.configurations) || spec.configurations.length === 0) {
      setJsonError('"configurations" must be a non-empty array');
      return;
    }

    abortRef.current = false;
    setRunning(true);
    setResult(null);
    setProgress({ completed: 0, total: spec.queries.length * spec.configurations.length, label: '' });

    try {
      const run = await runBenchmark(config, spec, (completed, total, label) => {
        setProgress({ completed, total, label });
      });
      setResult(run);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, [specJson, config]);

  const handleDownload = useCallback(() => {
    if (result) downloadReport(result);
  }, [result]);

  const handleSyncFilters = useCallback(() => {
    try {
      const parsed = normalizeSpecShape(JSON.parse(specJson) as BenchmarkSpec);
      const filters = parsed.searchFilters || [];
      syncFiltersFromBenchmark(filters);
      setSyncMessage(filters.length > 0 ? 'Filters synced to main search ✓' : 'Filters cleared from main search ✓');
      setTimeout(() => setSyncMessage(null), 3000);
    } catch (err) {
      setSyncMessage('Error: Invalid spec');
      setTimeout(() => setSyncMessage(null), 2000);
    }
  }, [specJson, syncFiltersFromBenchmark]);

  const handleSyncBoostRules = useCallback(() => {
    try {
      const parsed = normalizeSpecShape(JSON.parse(specJson) as BenchmarkSpec);
      const rules = parsed.queryBoostRules || [];
      syncBoostRulesFromBenchmark(rules);
      setSyncMessage(rules.length > 0 ? 'Boost rules synced to main search ✓' : 'Boost rules cleared from main search ✓');
      setTimeout(() => setSyncMessage(null), 3000);
    } catch (err) {
      setSyncMessage('Error: Invalid spec');
      setTimeout(() => setSyncMessage(null), 2000);
    }
  }, [specJson, syncBoostRulesFromBenchmark]);

  const handleExportActiveTabRules = useCallback(() => {
    try {
      const parsed = normalizeSpecShape(JSON.parse(specJson) as BenchmarkSpec);
      const payload = activeTab === 'boosts'
        ? { queryBoostRules: parsed.queryBoostRules || [] }
        : { searchFilters: parsed.searchFilters || [] };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = url;
      link.download = `benchmark-${activeTab}-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSyncMessage(`${activeTab === 'boosts' ? 'Boost rules' : 'Search filters'} exported`);
      setTimeout(() => setSyncMessage(null), 2500);
    } catch {
      setSyncMessage('Error: Invalid benchmark JSON');
      setTimeout(() => setSyncMessage(null), 2500);
    }
  }, [specJson, activeTab]);

  const handleImportActiveTabRules = useCallback(async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsedFile = JSON.parse(text) as Record<string, unknown> | unknown[];

      if (activeTab === 'boosts') {
        const importedRules = Array.isArray(parsedFile)
          ? parsedFile
          : Array.isArray((parsedFile as Record<string, unknown>)?.queryBoostRules)
            ? (parsedFile as Record<string, unknown>).queryBoostRules as unknown[]
            : null;

        if (!importedRules) {
          throw new Error('Expected JSON array or { queryBoostRules: [] }');
        }

        updateSpec((spec) => ({
          ...spec,
          queryBoostRules: importedRules as QueryBoostRule[],
        }));
      } else if (activeTab === 'filters') {
        const importedFilters = Array.isArray(parsedFile)
          ? parsedFile
          : Array.isArray((parsedFile as Record<string, unknown>)?.searchFilters)
            ? (parsedFile as Record<string, unknown>).searchFilters as unknown[]
            : null;

        if (!importedFilters) {
          throw new Error('Expected JSON array or { searchFilters: [] }');
        }

        updateSpec((spec) => ({
          ...spec,
          searchFilters: importedFilters as Array<{ field: string; values?: string[]; min?: number; max?: number }>,
        }));
      }

      setSyncMessage(`${activeTab === 'boosts' ? 'Boost rules' : 'Search filters'} imported`);
      setTimeout(() => setSyncMessage(null), 2500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid import JSON';
      setSyncMessage(`Import failed: ${message}`);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  }, [activeTab, updateSpec]);

  let parsedSpec: BenchmarkSpec | null = null;
  try {
    parsedSpec = normalizeSpecShape(JSON.parse(specJson) as BenchmarkSpec);
  } catch {
    parsedSpec = null;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
          >
            <ArrowLeft size={14} /> Back to Search
          </a>
          <span className="text-gray-200">|</span>
          <h1 className="text-sm font-bold uppercase tracking-widest">Search Benchmark</h1>
        </div>
        {result && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white text-[11px] font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
          >
            <Download size={14} /> Download Report
          </button>
        )}
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">
        {/* Config Editor */}
        <section className="bg-white border border-gray-200 rounded-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-widest">Benchmark Configuration</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Edit JSON below. Each configuration's <code className="bg-gray-100 px-1 rounded">overrides</code> are merged on top of the current app config.
              </p>
            </div>
            <button
              onClick={handleRun}
              disabled={running || !!jsonError}
              className="flex items-center gap-2 px-5 py-2.5 bg-black text-white text-[11px] font-bold uppercase tracking-widest hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Play size={13} />
              {running ? 'Running…' : 'Run Benchmark'}
            </button>
          </div>

          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <TabButton label="JSON Editor" active={activeTab === 'json'} onClick={() => setActiveTab('json')} />
              <TabButton label="Query Boosting" active={activeTab === 'boosts'} onClick={() => setActiveTab('boosts')} />
              <TabButton label="Search Filters" active={activeTab === 'filters'} onClick={() => setActiveTab('filters')} />
            </div>
            {(activeTab === 'boosts' || activeTab === 'filters') && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportActiveTabRules}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-700 text-[11px] font-bold uppercase tracking-widest border border-gray-200 hover:bg-gray-100 transition-colors rounded-sm"
                >
                  <Download size={12} /> Export JSON
                </button>
                <button
                  onClick={() => importRulesInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-700 text-[11px] font-bold uppercase tracking-widest border border-gray-200 hover:bg-gray-100 transition-colors rounded-sm"
                >
                  <Upload size={12} /> Import JSON
                </button>
                <input
                  ref={importRulesInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    handleImportActiveTabRules(e.target.files?.[0] ?? null);
                    e.currentTarget.value = '';
                  }}
                />

                {activeTab === 'boosts' && (
                  <button
                    onClick={handleSyncBoostRules}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 text-[11px] font-bold uppercase tracking-widest border border-blue-200 hover:bg-blue-100 transition-colors rounded-sm"
                  >
                    <Copy size={12} /> Sync to Main
                  </button>
                )}
                {activeTab === 'filters' && (
                  <button
                    onClick={handleSyncFilters}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 text-[11px] font-bold uppercase tracking-widest border border-blue-200 hover:bg-blue-100 transition-colors rounded-sm"
                  >
                    <Copy size={12} /> Sync to Main
                  </button>
                )}
              </div>
            )}
          </div>
          {syncMessage && (
            <div className="px-5 py-2 bg-green-50 border-b border-green-200 text-green-700 text-[11px] font-medium">
              {syncMessage}
            </div>
          )}

          <div className="p-5">
            {activeTab === 'json' ? (
              <textarea
                value={specJson}
                onChange={handleJsonChange}
                spellCheck={false}
                rows={20}
                className={`w-full font-mono text-[12px] bg-gray-50 border rounded-sm p-4 outline-none resize-y focus:bg-white transition-colors ${
                  jsonError ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-black'
                }`}
              />
            ) : activeTab === 'boosts' ? (
              <QueryBoostingTab parsedSpec={parsedSpec} onChange={updateSpec} />
            ) : (
              <SearchFiltersTab parsedSpec={parsedSpec} onChange={updateSpec} />
            )}
            {jsonError && (
              <div className="mt-2 flex items-start gap-2 text-red-600 text-[11px]">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                <span>{jsonError}</span>
              </div>
            )}
          </div>

          {/* Current app config reference */}
          <div className="border-t border-gray-100">
            <button
              onClick={() => setExpandedConfigs((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
            >
              <span>Current app config (available keys for overrides)</span>
              {expandedConfigs ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {expandedConfigs && (
              <pre className="px-5 pb-4 text-[11px] font-mono bg-gray-50 overflow-x-auto text-gray-600">
                {JSON.stringify(config, null, 2)}
              </pre>
            )}
          </div>
        </section>

        {/* Progress */}
        {running && progress && (
          <div className="bg-white border border-gray-200 rounded-sm px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-widest">
                Running… {progress.completed}/{progress.total}
              </span>
              <span className="text-[11px] text-gray-400 animate-pulse">{progress.label}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-black transition-all duration-300"
                style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Results */}
        {result && <BenchmarkResults run={result} />}
      </main>
    </div>
  );
};

const BenchmarkResults: React.FC<{ run: BenchmarkRun }> = ({ run }) => {
  const { spec, cells, rowKeys } = run;

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-widest">
          Results — {run.runAt.toLocaleString()}
        </h2>
        <span className="text-[11px] text-gray-400">
          {rowKeys.length} rows × {spec.configurations.length} configurations
        </span>
      </div>

      {rowKeys.map((rowKey) => {
        const rowCells = spec.configurations.map((cfg) =>
          cells.find((c) => c.rowKey === rowKey && c.configName === cfg.name),
        );
        const firstCell = rowCells.find(Boolean);
        const affinityProfileName = firstCell?.affinityProfileName;

        return (
          <div key={rowKey} className="bg-white border border-gray-200 rounded-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Query: </span>
              <span className="text-[13px] font-bold text-blue-600">"{firstCell?.query ?? rowKey}"</span>
              {affinityProfileName && (
                <span className="text-[10px] font-bold bg-violet-100 text-violet-700 rounded px-2 py-0.5">
                  persona: {affinityProfileName}
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {spec.configurations.map((cfg) => (
                      <th
                        key={cfg.name}
                        className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest border-b border-r border-gray-100 bg-white whitespace-nowrap"
                        style={{ minWidth: 220 }}
                      >
                        {cfg.name}
                        {cfg.description && (
                          <div className="font-normal normal-case tracking-normal text-[10px] text-gray-400 mt-0.5">
                            {cfg.description}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {rowCells.map((cell, i) => (
                      <td
                        key={i}
                        className="align-top px-4 py-4 border-r border-gray-100 last:border-r-0"
                        style={{ minWidth: 220 }}
                      >
                        {!cell ? (
                          <span className="text-[11px] text-gray-400">No data</span>
                        ) : (
                          <>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              <span className={`text-[10px] font-bold border rounded px-1.5 py-0.5 ${timingClass(cell.durationMs)}`}>
                                {cell.durationMs}ms
                              </span>
                              <span className={`text-[10px] font-bold border rounded px-1.5 py-0.5 ${statusClass(cell.statusCode)}`}>
                                {cell.statusCode ?? 'ERR'}
                              </span>
                              <span className="text-[10px] font-bold border rounded px-1.5 py-0.5 text-gray-500 border-gray-200">
                                {cell.totalResults.toLocaleString()} results
                              </span>
                            </div>
                            {cell.error && (
                              <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1.5 mb-2">
                                {cell.error}
                              </div>
                            )}
                            {cell.products.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {cell.products.map((p, pi) => (
                                  <a
                                    key={pi}
                                    href={p.url !== '#' ? p.url : undefined}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-[72px] flex flex-col group"
                                    title={p.title}
                                  >
                                    <div className="w-[72px] h-[96px] bg-gray-100 overflow-hidden">
                                      {p.imageUrl ? (
                                        <img
                                          src={p.imageUrl}
                                          alt={p.title}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[9px] text-gray-300 uppercase">
                                          No img
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-[9px] mt-1 text-gray-600 leading-tight line-clamp-2">{p.title}</p>
                                    <p className="text-[9px] font-bold text-gray-800">{p.price}</p>
                                  </a>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </section>
  );
};

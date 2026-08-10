import type { DYConfig, DynamicBoostingFactor } from '../context/ConfigContext';

export interface BenchmarkConfigItem {
  name: string;
  description?: string;
  /** Partial DYConfig values merged on top of the base app config */
  overrides: Partial<DYConfig>;
}

export interface AffinityProfileEntry {
  /** Display name for the benchmark row label, e.g. "czerwony" */
  name: string;
  /** The affinity profile object — sent as-is as `affinityProfile` in the search payload,
   *  same format as used by personas, e.g. { "color": { "czerwony": 1000 } } */
  profile: Record<string, unknown>;
}

export interface QueryBoostRule extends DynamicBoostingFactor {
  query: string;
}

export type QuerySpec =
  | string
  | {
      text: string;
      /** When provided, this query is expanded into one row per profile entry */
      affinityProfiles?: AffinityProfileEntry[];
    };

export interface BenchmarkSpec {
  queries: QuerySpec[];
  configurations: BenchmarkConfigItem[];
  queryBoostRules?: QueryBoostRule[];
    searchFilters?: Array<{ field: string; values?: string[]; min?: number; max?: number }>;
  /** Number of products to show per cell in the report */
  itemsToShow?: number;
}

export interface BenchmarkProduct {
  title: string;
  imageUrl: string;
  price: string | number;
  brand: string;
  url: string;
}

export interface BenchmarkCell {
  configName: string;
  configDescription: string;
  /** The search query text */
  query: string;
  /** Display row key — includes affinity profile name when applicable */
  rowKey: string;
  /** Set when this cell was run with a specific affinity profile */
  affinityProfileName?: string;
  durationMs: number;
  statusCode: number | null;
  totalResults: number;
  products: BenchmarkProduct[];
  error?: string;
}

export interface BenchmarkRun {
  spec: BenchmarkSpec;
  cells: BenchmarkCell[];
  /** Ordered list of row keys (one per expanded query/profile combination) */
  rowKeys: string[];
  runAt: Date;
  baseConfig: DYConfig;
}

/** Expand the queries array into a flat list of {text, rowKey, affinityProfile?} rows */
interface ExpandedRow {
  text: string;
  rowKey: string;
  affinityProfileName?: string;
  affinityProfile?: Record<string, unknown>;
}

function clampWeight(value: number) {
  return Math.max(-100, Math.min(100, value));
}

function buildDynamicPriorityFactors(
  factors: DynamicBoostingFactor[],
  prefix: string,
): Array<{ name: string; rule: Record<string, unknown>; weight: number }> {
  return factors
    .filter((factor) => factor.field?.trim() && factor.value?.trim())
    .map((factor, index) => ({
      name: `${prefix}_${index}`,
      rule: {
        contextTrigger: null,
        name: `${prefix}_${index}`,
        productsFilter: {
          items: [],
          query: {
            conditions: [
              {
                arguments: [
                  {
                    action: factor.matchType,
                    value: factor.value,
                  },
                ],
                field: factor.field,
              },
            ],
          },
          type: 'dynamic',
        },
      },
      weight: clampWeight(Number(factor.weight) || 0),
    }));
}

function parseAffinityProfile(config: DYConfig): Record<string, unknown> {
  if (!config.useAffinityBoosting || !config.affinityProfileJson.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(config.affinityProfileJson);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    return {};
  }

  return {};
}

function getQueryBoostRules(spec: BenchmarkSpec, query: string): DynamicBoostingFactor[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return (spec.queryBoostRules || []).filter((rule) => rule.query.trim().toLocaleLowerCase() === normalizedQuery);
}

function expandQueries(queries: QuerySpec[]): ExpandedRow[] {
  const rows: ExpandedRow[] = [];
  for (const q of queries) {
    if (typeof q === 'string') {
      rows.push({ text: q, rowKey: q });
    } else if (q.affinityProfiles && q.affinityProfiles.length > 0) {
      for (const ap of q.affinityProfiles) {
        rows.push({
          text: q.text,
          rowKey: `${q.text} — ${ap.name}`,
          affinityProfileName: ap.name,
          affinityProfile: ap.profile,
        });
      }
    } else {
      rows.push({ text: q.text, rowKey: q.text });
    }
  }
  return rows;
}

function buildPayload(
  config: DYConfig,
  query: string,
  queryBoostFactors: DynamicBoostingFactor[] = [],
    searchFilters: Array<{ field: string; values?: string[]; min?: number; max?: number }> = [],
  affinityProfileOverride?: Record<string, unknown>,
) {
  const fId = isNaN(Number(config.feedId)) ? config.feedId : Number(config.feedId);
  const isEu = config.sectionId?.startsWith('98');
  const region = isEu ? 'EU' : 'US';

  const affinityProfile = affinityProfileOverride && Object.keys(affinityProfileOverride).length > 0
    ? affinityProfileOverride
    : parseAffinityProfile(config);
  const dynamicPriorityFactors = buildDynamicPriorityFactors(
    [
      ...(config.useDynamicBoosting ? config.dynamicBoostingFactors || [] : []),
      ...queryBoostFactors,
    ],
    'filter',
  );
  const affinityPriorityFactors = Object.keys(affinityProfile).length > 0
    ? [{ name: 'USER_AFFINITIES_V2', weight: clampWeight(Number(config.affinityBoostWeight) || 80) }]
    : [];
  const priorityFactors = [...dynamicPriorityFactors, ...affinityPriorityFactors];

  const searchObj: Record<string, unknown> = {
    text: query || '*',
    pagination: { numItems: config.itemsPerPage, offset: 0 },
    suggestMode: config.suggestMode,
    explain_mode: config.explainMode,
    translation_enabled: config.translationEnabled,
    plp_search_mode: config.plpSearchMode,
    image_boost: config.imageBoost,
    image_knn_threshold: config.imageKnnThreshold,
    text_knn_threshold: config.textKnnThreshold,
    k: config.k,
    num_candidates: config.numCandidates,
    ...(priorityFactors.length > 0 ? { priorityFactors } : {}),
    ...(Object.keys(affinityProfile).length > 0 ? { affinityProfile } : {}),
  };

  if (config.useSearchFormula && config.searchFormula) {
    searchObj.search_formula = config.searchFormula;
  }
  if (config.useBucketSize) {
    searchObj.bucket_size = config.bucketSize;
  }
  if (config.useLocale && config.locale) {
    searchObj.locale = config.locale;
  }

  return {
    region,
    sectionId: config.sectionId,
    data: [
      {
        fId,
        ...(config.widgetId ? { wId: String(config.widgetId) } : {}),
        maxProducts: config.maxProducts,
        rules: [],
        filtering: [],
        strategy: config.strategy,
        searchFilters: searchFilters.length > 0 ? searchFilters : [],
        search: searchObj,
      },
    ],
    ctx: { lng: config.language, type: config.ctxType },
    geoLocation: { geoCode: config.geoCode, geoRegionCode: config.geoRegionCode },
    ...(config.uid ? { uid: config.uid } : {}),
  };
}

function extractProducts(json: unknown, config: DYConfig, limit: number): BenchmarkProduct[] {
  try {
    const response = (json as any)?.response;
    const firstResponse = Array.isArray(response) ? response[0] : null;
    const slots: any[] = Array.isArray(firstResponse?.slots) ? firstResponse.slots : [];

    return slots
      .filter((s) => s?.item != null)
      .slice(0, limit)
      .map((s) => {
        const item = s.item;
        const pick = (fields: string | string[]) => {
          const arr = Array.isArray(fields) ? fields : [fields];
          for (const f of arr) {
            if (item[f] != null && item[f] !== '') return item[f];
          }
          return '';
        };
        return {
          title: pick(config.mapping.title),
          imageUrl: pick(config.mapping.image),
          price: pick(config.mapping.price),
          brand: pick(config.mapping.brand),
          url: pick(config.mapping.url),
        };
      });
  } catch {
    return [];
  }
}

function extractTotalResults(json: unknown): number {
  try {
    const response = (json as any)?.response;
    const firstResponse = Array.isArray(response) ? response[0] : null;
    return typeof firstResponse?.totalNumResults === 'number' ? firstResponse.totalNumResults : 0;
  } catch {
    return 0;
  }
}

export async function runBenchmark(
  baseConfig: DYConfig,
  spec: BenchmarkSpec,
  onProgress: (completed: number, total: number, label: string) => void,
): Promise<BenchmarkRun> {
  const itemsToShow = spec.itemsToShow ?? 6;
  const expandedRows = expandQueries(spec.queries);
  const total = expandedRows.length * spec.configurations.length;
  let completed = 0;

  const cells: BenchmarkCell[] = [];

  for (const row of expandedRows) {
    for (const configItem of spec.configurations) {
      const mergedConfig: DYConfig = { ...baseConfig, ...configItem.overrides };
      const label = `"${row.rowKey}" — ${configItem.name}`;
      onProgress(completed, total, label);

      const payload = buildPayload(mergedConfig, row.text, getQueryBoostRules(spec, row.text), spec.searchFilters || [], row.affinityProfile);
      const start = performance.now();
      let statusCode: number | null = null;
      let cell: BenchmarkCell;

      try {
        const response = await fetch('/api/dy-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30_000),
        });
        const durationMs = Math.round(performance.now() - start);
        statusCode = response.status;

        if (!response.ok) {
          const text = await response.text();
          cell = {
            configName: configItem.name,
            configDescription: configItem.description ?? '',
            query: row.text,
            rowKey: row.rowKey,
            affinityProfileName: row.affinityProfileName,
            durationMs,
            statusCode,
            totalResults: 0,
            products: [],
            error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
          };
        } else {
          const json = await response.json();
          cell = {
            configName: configItem.name,
            configDescription: configItem.description ?? '',
            query: row.text,
            rowKey: row.rowKey,
            affinityProfileName: row.affinityProfileName,
            durationMs,
            statusCode,
            totalResults: extractTotalResults(json),
            products: extractProducts(json, mergedConfig, itemsToShow),
          };
        }
      } catch (err) {
        const durationMs = Math.round(performance.now() - start);
        cell = {
          configName: configItem.name,
          configDescription: configItem.description ?? '',
          query: row.text,
          rowKey: row.rowKey,
          affinityProfileName: row.affinityProfileName,
          durationMs,
          statusCode,
          totalResults: 0,
          products: [],
          error: err instanceof Error ? err.message : String(err),
        };
      }

      cells.push(cell);
      completed++;
      onProgress(completed, total, label);
    }
  }

  return {
    spec,
    cells,
    rowKeys: expandedRows.map((r) => r.rowKey),
    runAt: new Date(),
    baseConfig,
  };
}

export interface NormalizedFacetOption {
  value: string;
  count?: number;
}

export interface NormalizedFacet {
  key: string;
  title: string;
  type: 'string' | 'number' | 'unknown';
  options?: NormalizedFacetOption[];
  min?: number;
  max?: number;
}

export interface NormalizedDyPayload {
  items: any[];
  facets: NormalizedFacet[];
  totalNumResults: number;
  rawEntry: any;
}

function normalizeFacetOptions(value: any): NormalizedFacetOption[] {
  if (!Array.isArray(value)) {
    if (typeof value === 'object' && value !== null) {
      return Object.entries(value).map(([key, count]) => ({
        value: String(key),
        count: typeof count === 'number' ? count : undefined,
      }));
    }

    return [];
  }

  return value
    .map((option: any) => {
      if (option == null) return null;
      const rawValue = option.value ?? option.name ?? option.label ?? option?.key ?? option;
      const valueStr = rawValue !== undefined && rawValue !== null ? String(rawValue) : '';
      if (!valueStr) return null;
      return {
        value: valueStr,
        count: typeof option.count === 'number' ? option.count : undefined,
      } as NormalizedFacetOption;
    })
    .filter((option): option is NormalizedFacetOption => option !== null);
}

function normalizeFacets(facets: any): NormalizedFacet[] {
  if (Array.isArray(facets)) {
    return facets.map((facet: any, idx: number) => {
      const options = normalizeFacetOptions(facet.values ?? facet.options ?? []);
      const hasNumericRange = typeof facet.min === 'number' || typeof facet.max === 'number';
      const type = facet.valuesType === 'number' || hasNumericRange ? 'number' : 'string';
      return {
        key: facet.column ?? facet.displayName ?? `facet-${idx}`,
        title: facet.displayName ?? facet.column ?? `Facet ${idx + 1}`,
        type: type,
        options: options.length > 0 ? options : undefined,
        min: typeof facet.min === 'number' ? facet.min : undefined,
        max: typeof facet.max === 'number' ? facet.max : undefined,
      };
    });
  }

  if (facets && typeof facets === 'object') {
    return Object.entries(facets).map(([key, rawOptions]) => ({
      key,
      title: key,
      type: 'string',
      options: normalizeFacetOptions(rawOptions),
    }));
  }

  return [];
}

function extractResponseEntry(response: any): any {
  if (!response) return null;
  if (Array.isArray(response)) return response[0] ?? null;
  if (response.response && Array.isArray(response.response)) return response.response[0] ?? null;
  return response;
}

export function extractDyPayload(response: any): NormalizedDyPayload {
  try {
    const entry = extractResponseEntry(response) ?? {};
    const slots = Array.isArray(entry.slots) ? entry.slots : Array.isArray(response?.slots) ? response.slots : [];
    const items = slots
      .filter((slot: any) => slot && typeof slot === 'object' && slot.item != null)
      .map((slot: any) => slot.item);
    const facets = normalizeFacets(entry.facets ?? response?.facets ?? []);
    const totalNumResults = typeof entry.totalNumResults === 'number'
      ? entry.totalNumResults
      : typeof response?.totalNumResults === 'number'
      ? response.totalNumResults
      : 0;

    return {
      items,
      facets,
      totalNumResults,
      rawEntry: entry,
    };
  } catch (error) {
    console.error('Failed to normalize DY payload:', error, response);
    return {
      items: [],
      facets: [],
      totalNumResults: 0,
      rawEntry: null,
    };
  }
}


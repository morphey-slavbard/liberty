import { useQuery } from '@tanstack/react-query';
import { useConfig } from '../context/ConfigContext';
import { useRequestLog } from '../context/RequestLogContext';
import { usePersona } from '../context/PersonaContext';

export interface DYSearchResponse {
  totalNumResults: number;
  slots: Array<{
    item: any;
    strId: string | number;
    md: any;
    fallback: boolean;
  }>;
  facets: {
    [key: string]: Array<{
      value: string;
      count: number;
    }>;
  };
  spellCheckedQuery: string | null;
  translatedQuery: string | null;
  errorMessage: string | null;
  isFallback: boolean;
}

export const useDYSearch = (query: string, offset: number, filters: any[] = []) => {
  const { config, setLastRequestPayload, cacheInvalidationKey } = useConfig();
  const { loggedFetch } = useRequestLog();
  const { activePersona } = usePersona();

  return useQuery({
    queryKey: ['dySearch', query, offset, filters, config.sectionId, config.feedId, config, activePersona?.id, activePersona?.affinityProfileJson, cacheInvalidationKey],
    // Retry up to 2× for transient/network/timeout errors; skip retries for 4xx client errors
    retry: (failureCount, err) => {
      if (err instanceof Error && /DY API Error: 4\d\d/.test(err.message)) return false;
      return failureCount < 2;
    },
    retryDelay: 1000,
    staleTime: 30_000,
    queryFn: async (): Promise<DYSearchResponse> => {
      // If we don't have IDs, return early (though Query will be disabled)
      if (!config.sectionId || !config.feedId) {
        throw new Error('Section ID and Feed ID are required');
      }

      const fId = isNaN(Number(config.feedId)) ? config.feedId : Number(config.feedId);

      const isEu = config.sectionId?.startsWith('98');
      const region = isEu ? 'EU' : 'US';

      const clampWeight = (value: number) => Math.max(-100, Math.min(100, value));

      const normalizedQuery = (query || '').trim().toLowerCase();
      const queryBoostFactors = (config.queryBoostRules || [])
        .filter((rule) => rule.query?.trim().toLowerCase() === normalizedQuery)
        .map((rule) => ({
          field: rule.field,
          value: rule.value,
          matchType: rule.matchType,
          weight: rule.weight,
        }));

      const baseDynamicFactors = config.useDynamicBoosting ? (config.dynamicBoostingFactors || []) : [];
      const allDynamicFactors = [...baseDynamicFactors, ...queryBoostFactors];

      const dynamicPriorityFactors = allDynamicFactors.length > 0
        ? allDynamicFactors
            .filter((factor) => factor.field?.trim() && factor.value?.trim())
            .map((factor, idx) => ({
              name: `filter_${idx}`,
              rule: {
                contextTrigger: null,
                name: `filter_${idx}`,
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
            }))
        : [];

      const affinityPriorityFactors = (activePersona || config.useAffinityBoosting)
        ? [
            {
              name: 'USER_AFFINITIES_V2',
              weight: clampWeight(Number(config.affinityBoostWeight) || 0),
            },
          ]
        : [];

      let affinityProfile: Record<string, unknown> = {};

      // Active persona overrides config affinity profile
      if (activePersona) {
        try {
          const parsed = JSON.parse(activePersona.affinityProfileJson);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            affinityProfile = parsed;
          }
        } catch {
          console.warn('Invalid persona affinity profile JSON.');
        }
      } else if (config.useAffinityBoosting && config.affinityProfileJson.trim()) {
        try {
          const parsed = JSON.parse(config.affinityProfileJson);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            affinityProfile = parsed;
          }
        } catch (error) {
          console.warn('Invalid affinity profile JSON. Using empty affinity profile.');
        }
      }

      const priorityFactors = [...dynamicPriorityFactors, ...affinityPriorityFactors];

      // Build search object with optional parameters
      const searchObj: any = {
        text: query || "*",
        pagination: {
          numItems: config.itemsPerPage,
          offset: offset,
        },
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

      // Conditionally add optional parameters
      if (config.useSearchFormula && config.searchFormula) {
        searchObj.search_formula = config.searchFormula;
      }
      if (config.useBucketSize) {
        searchObj.bucket_size = config.bucketSize;
      }
      if (config.sortByEnabled) {
        searchObj.sortBy = { field: 'popularity' };
      }
      if (config.useLocale && config.locale) {
        searchObj.locale = config.locale;
      }

      const buildPayload = (searchOverride: any) => ({
        data: [
          {
            fId: fId,
            ...(config.widgetId ? { wId: String(config.widgetId) } : {}),
            maxProducts: config.maxProducts,
            rules: [],
            filtering: [],
            strategy: config.strategy,
            searchFilters: [...(config.searchFilters || []), ...filters],
            search: searchOverride,
          },
        ],
        ctx: { 
          lng: config.language, 
          type: config.ctxType 
        },
        geoLocation: {
          geoCode: config.geoCode,
          geoRegionCode: config.geoRegionCode
        },
        ...(config.uid ? { uid: config.uid } : {}),
      });

      const fetchResults = async (searchOverride: any): Promise<{ json: any }> => {
        const payload = buildPayload(searchOverride);
        const requestPayload = { region, sectionId: config.sectionId, ...payload };
        const response = await loggedFetch('/api/dy-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayload),
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`DY API Error: ${response.status} - ${errorText}`);
        }
        return { json: await response.json() };
      };

      const parseResponse = (json: any, isFallback: boolean): DYSearchResponse => {
        console.log('DY Search Response Data:', json);
        if (!json.response || !Array.isArray(json.response) || json.response.length === 0) {
          console.error('DY API: Unexpected response structure', json);
          throw new Error('Invalid response format: Missing "response" array or empty response.');
        }
        const firstResponse = json.response[0];
        return {
          totalNumResults: firstResponse.totalNumResults ?? 0,
          slots: firstResponse.slots || [],
          facets: firstResponse.facets || {},
          spellCheckedQuery: firstResponse.spellCheckedQuery || null,
          translatedQuery: firstResponse.translatedQuery || null,
          errorMessage: firstResponse.errorMessage || null,
          isFallback,
        };
      };

      const hasAffinityProfile = Object.keys(affinityProfile).length > 0;

      // Create clean payload for display (without region/sectionId)
      setLastRequestPayload(buildPayload(searchObj));

      const { json: primaryJson } = await fetchResults(searchObj);
      const primaryResult = parseResponse(primaryJson, false);

      // Fallback: if affinity profile was used but returned 0 results, retry without it
      if (hasAffinityProfile && primaryResult.totalNumResults === 0) {
        const fallbackSearchObj = { ...searchObj };
        delete fallbackSearchObj.affinityProfile;
        const { json: fallbackJson } = await fetchResults(fallbackSearchObj);
        return parseResponse(fallbackJson, true);
      }

      return primaryResult;
    },
    enabled: !!config.sectionId && !!config.feedId,
  });
};

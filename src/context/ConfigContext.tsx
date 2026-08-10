import React, { createContext, useContext, useState, useEffect } from 'react';

export type BoostMatchType = 'IS' | 'CONTAINS' | 'IS_NOT';

export interface DynamicBoostingFactor {
  field: string;
  value: string;
  matchType: BoostMatchType;
  weight: number;
}

export interface SearchFilter {
  field: string;
  values?: string[];
  min?: number;
  max?: number;
}

export interface QueryBoostRule extends DynamicBoostingFactor {
  query: string;
}

export interface DYConfig {
  sectionId: string;
  feedId: string;
  widgetId: string;
  experienceApiKey: string;
  language: string;
  ctxType: string;
  itemsPerPage: number;
  maxProducts: number;
  strategy: string;
  suggestMode: boolean;
  explainMode: boolean;
  translationEnabled: boolean;
  plpSearchMode: boolean;
  imageBoost: number;
  imageKnnThreshold: number;
  textKnnThreshold: number;
  k: number;
  numCandidates: number;
  searchFormula: string;
  useSearchFormula: boolean;
  bucketSize: number;
  useBucketSize: boolean;
  locale: string;
  useLocale: boolean;
  sortByEnabled: boolean;
  uid: string;
  geoCode: string;
  geoRegionCode: string;
  logoUrl: string;
  currency: string;
  categoryPath: string;
  useDynamicBoosting: boolean;
  dynamicBoostingFactors: DynamicBoostingFactor[];
  useAffinityBoosting: boolean;
  affinityBoostWeight: number;
  affinityProfileJson: string;
  mapping: {
    title: string[];
    image: string[];
    url: string[];
    price: string[];
    brand: string;
  };
  searchFilters?: SearchFilter[];
  queryBoostRules?: QueryBoostRule[];
}

const defaultConfig: DYConfig = {
  sectionId: '8787656',
  feedId: '85470',
  widgetId: '464618',
  experienceApiKey: '6db1658990995233071fe0221961589aa600a0ffc97c233007c9d3d56ad2b1f2',
  language: 'en_US',
  ctxType: 'HOMEPAGE',
  itemsPerPage: 12,
  maxProducts: 1000,
  strategy: 'SEMANTIC_SEARCH',
  suggestMode: true,
  explainMode: false,
  translationEnabled: false,
  plpSearchMode: false,
  imageBoost: 0.5,
  imageKnnThreshold: 0.8,
  textKnnThreshold: 0.7,
  k: 100,
  numCandidates: 500,
  searchFormula: '',
  useSearchFormula: false,
  bucketSize: 10,
  useBucketSize: false,
  locale: 'en_US',
  useLocale: false,
  sortByEnabled: false,
  uid: '9190339902873124000',
  geoCode: 'US',
  geoRegionCode: 'US_VA',
  logoUrl: '/logo.png',
  currency: '$',
  categoryPath: 'Blueberry / Search',
  useDynamicBoosting: false,
  dynamicBoostingFactors: [
    {
      field: 'categories',
      value: 'long sleeve dresses',
      matchType: 'IS',
      weight: 50,
    },
  ],
  useAffinityBoosting: false,
  affinityBoostWeight: 80,
  affinityProfileJson: '{\n  "categories": {\n    "Men": 100\n  }\n}',
  searchFilters: [],
  queryBoostRules: [],
  mapping: {
    title: ['name', 'productName'],
    image: ['image_url', 'image_url_small', 'imageUrl'],
    url: ['url', 'product_url'],
    price: ['price', 'dy_display_price'],
    brand: 'brand'
  }
};

const ConfigContext = createContext<{ 
  config: DYConfig; 
  setConfig: (c: DYConfig) => void;
  lastRequestPayload: any;
  setLastRequestPayload: (p: any) => void;
  syncFiltersFromBenchmark: (filters: SearchFilter[]) => void;
  syncBoostRulesFromBenchmark: (rules: QueryBoostRule[]) => void;
  clearQueryCache: () => void;
  cacheInvalidationKey: number;
} | null>(null);

export const ConfigProvider = ({ children }: { children: React.ReactNode }) => {
  const [lastRequestPayload, setLastRequestPayload] = useState<any>(null);
  const [cacheInvalidationKey, setCacheInvalidationKey] = useState(0);
  const [config, setConfig] = useState<DYConfig>(() => {
    const saved = localStorage.getItem('dy_sinsay_config');
    try {
      const parsed = saved ? JSON.parse(saved) : defaultConfig;
      // Strip deprecated/removed fields
      const { endpoint, region, visualSearchApiKey, shoppingMuseApiKey, geminiApiKey, ...cleanConfig } = parsed;
      // Only carry over keys that exist in the current DYConfig interface
      const validKeys = Object.keys(defaultConfig) as (keyof DYConfig)[];
      const filtered = Object.fromEntries(
        validKeys
          .filter(k => k in cleanConfig && cleanConfig[k] !== undefined)
          .map(k => [k, cleanConfig[k]])
      );
      return {
        ...defaultConfig,
        ...filtered,
        mapping: {
          ...defaultConfig.mapping,
          ...(cleanConfig.mapping || {}),
        },
        dynamicBoostingFactors: Array.isArray(cleanConfig.dynamicBoostingFactors)
          ? cleanConfig.dynamicBoostingFactors
          : defaultConfig.dynamicBoostingFactors,
      };
    } catch (e) {
      return defaultConfig;
    }
  });

  useEffect(() => {
    localStorage.setItem('dy_sinsay_config', JSON.stringify(config));
  }, [config]);

  const syncFiltersFromBenchmark = (filters: SearchFilter[]) => {
    setConfig(prev => ({
      ...prev,
      searchFilters: filters,
    }));
    setCacheInvalidationKey(k => k + 1);
  };

  const syncBoostRulesFromBenchmark = (rules: QueryBoostRule[]) => {
    setConfig(prev => ({
      ...prev,
      queryBoostRules: rules,
    }));
    setCacheInvalidationKey(k => k + 1);
  };

  const clearQueryCache = () => {
    // Signal React Query to invalidate all queries
    setCacheInvalidationKey(k => k + 1);
    // Also clear the displayed payload
    setLastRequestPayload(null);
  };

  return (
    <ConfigContext.Provider value={{ 
      config, 
      setConfig, 
      lastRequestPayload, 
      setLastRequestPayload,
      syncFiltersFromBenchmark,
      syncBoostRulesFromBenchmark,
      clearQueryCache,
      cacheInvalidationKey,
    }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

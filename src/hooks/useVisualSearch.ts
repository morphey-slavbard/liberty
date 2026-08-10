import { useQuery } from '@tanstack/react-query';
import { useConfig } from '../context/ConfigContext';
import { useRequestLog } from '../context/RequestLogContext';

export interface VisualSearchInput {
  imageBase64?: string;
  imageUrl?: string;
}

export interface VisualSearchResult {
  results: any[];
  totalResults: number;
  loading: boolean;
  error: string | null;
}

export function useVisualSearch(input: VisualSearchInput | null) {
  const { config } = useConfig();
  const { loggedFetch } = useRequestLog();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['visualSearch', input?.imageUrl ?? input?.imageBase64 ?? ''],
    queryFn: async () => {
      if (!input?.imageBase64 && !input?.imageUrl) {
        throw new Error('No image provided');
      }

      const response = await loggedFetch('/api/visual-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          sectionId: config.sectionId,
          ...(config.experienceApiKey ? { apiKey: config.experienceApiKey } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Visual search failed: ${response.statusText}`
        );
      }

      return response.json();
    },
    enabled: !!input?.imageBase64 || !!input?.imageUrl,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    results: data?.results || [],
    totalResults:
      typeof data?.totalResults === 'number'
        ? data.totalResults
        : data?.results?.length ?? 0,
    loading: isLoading,
    error: error ? error.message : null,
    refetch,
  };
}

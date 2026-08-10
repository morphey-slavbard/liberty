import { useMutation } from '@tanstack/react-query';
import { useConfig } from '../context/ConfigContext';
import { useRequestLog } from '../context/RequestLogContext';

export interface ShoppingMuseWidgetSlot {
  slotId?: string;
  sku?: string;
  productData?: Record<string, unknown>;
}

export interface ShoppingMuseWidget {
  title?: string;
  slots?: ShoppingMuseWidgetSlot[];
}

export interface ShoppingMuseResponse {
  assistant: string;
  chatId: string | null;
  support: boolean;
  widgets: ShoppingMuseWidget[];
  warnings: Array<{ code?: string; message?: string }>;
  rawResponse?: unknown;
}

interface ShoppingMuseRequest {
  text: string;
  chatId?: string;
}

export function useShoppingMuse() {
  const { config } = useConfig();
  const { loggedFetch } = useRequestLog();

  return useMutation({
    mutationFn: async ({ text, chatId }: ShoppingMuseRequest): Promise<ShoppingMuseResponse> => {
      const locale = config.useLocale && config.locale ? config.locale : config.language;

      const response = await loggedFetch('/api/shopping-muse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          chatId,
          locale,
          sectionId: config.sectionId,
          pageLocation: typeof window !== 'undefined' ? window.location.href : undefined,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          ...(config.experienceApiKey ? { apiKey: config.experienceApiKey } : {}),        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const details = typeof errorData.details === 'string' ? ` ${errorData.details}` : '';
        throw new Error(
          errorData.message || errorData.error || `Shopping Muse failed: ${response.statusText}${details}`
        );
      }

      return response.json();
    },
  });
}

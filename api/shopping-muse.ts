interface ShoppingMuseRequestBody {
  text?: string;
  chatId?: string;
  locale?: string;
  pageLocation?: string;
  userAgent?: string;
}

interface ShoppingMuseApiResponse {
  choices?: Array<{
    variations?: Array<{
      payload?: {
        data?: {
          assistant?: string;
          chatId?: string;
          support?: boolean;
          widgets?: Array<{
            title?: string;
            slots?: Array<{
              slotId?: string;
              sku?: string;
              productData?: Record<string, unknown>;
            }>;
          }> | null;
        };
      };
    }>;
  }>;
  warnings?: Array<{
    code?: string;
    message?: string;
  }>;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as ShoppingMuseRequestBody;
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : '';
  const locale = typeof body.locale === 'string' && body.locale.trim() ? body.locale.trim() : 'en_US';
  const pageLocation =
    typeof body.pageLocation === 'string' && body.pageLocation.trim()
      ? body.pageLocation.trim()
      : 'https://www.mypage.com';
  const userAgent =
    typeof body.userAgent === 'string' && body.userAgent.trim()
      ? body.userAgent.trim()
      : 'Mozilla/5.0';
  const deviceType = /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent) ? 'MOBILE' : 'DESKTOP';

  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  if (text.length > 250) {
    return res.status(400).json({ error: 'text must be 250 characters or fewer' });
  }

  const clientApiKey = typeof (body as any).apiKey === 'string' ? (body as any).apiKey.trim() : '';
  const apiKey = clientApiKey || ((globalThis as any).process?.env?.EXPERIENCE_API_KEY as string | undefined) || ((globalThis as any).process?.env?.SHOPPINGMUSE_API_KEY as string | undefined);
  if (!apiKey) {
    console.error('[Shopping Muse] API key not configured');
    return res.status(500).json({ error: 'Shopping Muse API key not configured' });
  }

  const sectionId = typeof (body as any).sectionId === 'string' ? (body as any).sectionId : '';
  const isEu = sectionId.startsWith('98');
  const dyApiBase = isEu ? 'https://dy-api.eu' : 'https://dy-api.com';

  // Dummy values requested for Muse identity/session fields.
  const dummyDyid = '123';
  const dummySessionDy = 'ohyr6v42l9zd4bpinnvp7urjjx9lrssw';

  const payload: Record<string, unknown> = {
    user: {
      active_consent_accepted: true,
      dyid: dummyDyid,
      dyid_server: dummyDyid,
    },
    session: {
      dy: dummySessionDy,
    },
    query: {
      ...(chatId ? { chatId } : {}),
      text,
    },
    context: {
      page: {
        type: 'HOMEPAGE',
        data: ['p12345'],
        location: pageLocation,
        locale,
      },
      device: {
        userAgent,
        type: deviceType,
      },
    },
    selector: {
      name: 'Shopping Muse',
    },
    options: {
      returnAnalyticsMetadata: false,
      isImplicitClientData: false,
      isImplicitKeywordSearchEvent: false,
    },
  };

  try {
    const upstreamUrl = `${dyApiBase}/v2/serve/user/agent-assistant`;
    const response = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'dy-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const upstreamHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => { upstreamHeaders[key] = value; });
    const upstream = { url: upstreamUrl, requestBody: payload, status: response.status, statusText: response.statusText, headers: upstreamHeaders };

    if (!response.ok) {
      const details = await response.text();
      console.error('[Shopping Muse] API error:', response.status, details);
      return res.status(response.status).json({
        error: 'Shopping Muse request failed',
        message: details || `Remote status ${response.status}`,
        details,
        _upstream: upstream,
      });
    }

    const data = (await response.json()) as ShoppingMuseApiResponse;
    const museData = data.choices?.[0]?.variations?.[0]?.payload?.data;

    return res.status(200).json({
      assistant: museData?.assistant ?? '',
      chatId: museData?.chatId ?? null,
      support: Boolean(museData?.support),
      widgets: museData?.widgets ?? [],
      warnings: data.warnings ?? [],
      rawResponse: data,
      _upstream: upstream,
    });
  } catch (error) {
    console.error('[Shopping Muse] Proxy error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { region, sectionId, ...dyPayload } = req.body;

  const dyRegion = region || 'US';
  const dySectionId = sectionId || '8770123';
  const baseUrl = dyRegion === 'EU' ? 'https://recs-search-eu.dynamicyield.com/search/' : 'https://recs-search.dynamicyield.com/search/';
  const upstreamUrl = `${baseUrl}${dySectionId}`;

  try {
    const response = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dyPayload),
    });

    const upstreamHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => { upstreamHeaders[key] = value; });

    const text = await response.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { error: text }; }

    // Attach upstream details so the client can display them in the network log
    res.status(response.status).json({
      ...data,
      _upstream: {
        url: upstreamUrl,
        requestBody: dyPayload,
        status: response.status,
        statusText: response.statusText,
        headers: upstreamHeaders,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cause = (error as any)?.cause?.code ?? (error as any)?.cause?.message ?? '';
    res.status(500).json({ error: 'Proxy error', message, ...(cause ? { cause } : {}) });
  }
}
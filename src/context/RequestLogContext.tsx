import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

export interface RequestLogEntry {
  id: string;
  timestamp: Date;
  method: string;
  url: string;
  requestBody: unknown;
  status: number | null;
  statusText: string;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  error: string | null;
  durationMs: number | null;
  // Upstream (DY API) details forwarded by the proxy
  upstream?: {
    url: string;
    requestBody: unknown;
    status: number;
    statusText: string;
    headers: Record<string, string>;
  };
}

interface RequestLogContextValue {
  log: RequestLogEntry[];
  loggedFetch: (url: string, init?: RequestInit) => Promise<Response>;
  clearLog: () => void;
}

const RequestLogContext = createContext<RequestLogContextValue | null>(null);

let idCounter = 0;

export const RequestLogProvider = ({ children }: { children: React.ReactNode }) => {
  const [log, setLog] = useState<RequestLogEntry[]>([]);
  const logRef = useRef(log);
  logRef.current = log;

  const loggedFetch = useCallback(async (url: string, init?: RequestInit): Promise<Response> => {
    const id = String(++idCounter);
    const method = (init?.method ?? 'GET').toUpperCase();
    let requestBody: unknown = undefined;
    try {
      requestBody = init?.body ? JSON.parse(init.body as string) : undefined;
    } catch {
      requestBody = init?.body;
    }

    const entry: RequestLogEntry = {
      id,
      timestamp: new Date(),
      method,
      url,
      requestBody,
      status: null,
      statusText: '',
      responseHeaders: {},
      responseBody: null,
      error: null,
      durationMs: null,
    };

    setLog(prev => [entry, ...prev].slice(0, 50));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);

    const start = performance.now();
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);
      const durationMs = Math.round(performance.now() - start);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => { responseHeaders[key] = value; });

      let responseBody: unknown = null;
      try {
        responseBody = await response.clone().json();
      } catch {
        try { responseBody = await response.clone().text(); } catch {}
      }

      // Extract upstream details if the proxy included them
      const upstream = (responseBody as any)?._upstream ?? undefined;
      // Strip _upstream and rawResponse from the displayed response body
      let displayBody = responseBody;
      if (responseBody && typeof responseBody === 'object') {
        const { _upstream, rawResponse, ...rest } = responseBody as any;
        displayBody = rest;
      }

      setLog(prev => prev.map(e => e.id === id
        ? { ...e, status: response.status, statusText: response.statusText, responseHeaders, responseBody: displayBody, durationMs, upstream }
        : e
      ));

      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      const durationMs = Math.round(performance.now() - start);
      const error = err instanceof Error ? err.message : String(err);
      setLog(prev => prev.map(e => e.id === id ? { ...e, error, durationMs } : e));
      throw err;
    }
  }, []);

  const clearLog = useCallback(() => setLog([]), []);

  return (
    <RequestLogContext.Provider value={{ log, loggedFetch, clearLog }}>
      {children}
    </RequestLogContext.Provider>
  );
};

export const useRequestLog = () => {
  const ctx = useContext(RequestLogContext);
  if (!ctx) throw new Error('useRequestLog must be used within a RequestLogProvider');
  return ctx;
};

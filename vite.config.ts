import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

function apiRoutesPlugin() {
  return {
    name: 'api-routes',
    configureServer(server: any) {
      server.middlewares.use('/api', async (req: IncomingMessage & { body?: any; query?: any }, res: ServerResponse, next: () => void) => {
        // Derive handler filename from URL (strip query string and leading slash)
        const urlPath = (req.url ?? '/').split('?')[0].replace(/^\//, '');
        if (!urlPath) return next();

        // Parse query params
        const queryString = (req.url ?? '').split('?')[1] ?? '';
        const query = Object.fromEntries(new URLSearchParams(queryString));

        // Buffer and parse JSON body
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        await new Promise(resolve => req.on('end', resolve));
        const raw = Buffer.concat(chunks).toString();
        let body: any = {};
        try { body = raw ? JSON.parse(raw) : {}; } catch {}

        req.body = body;
        req.query = query;

        // Patch Express-style helpers onto the raw Node response
        const anyRes = res as any;
        anyRes.status = (code: number) => { res.statusCode = code; return anyRes; };
        anyRes.json = (data: unknown) => {
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          }
          return anyRes;
        };

        try {
          const mod = await server.ssrLoadModule(`/api/${urlPath}.ts`);
          await mod.default(req, res);
        } catch (e: any) {
          console.error(`[api-routes] Error in /api/${urlPath}:`, e);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error', message: e?.message }));
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), apiRoutesPlugin()],
    define: {},
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

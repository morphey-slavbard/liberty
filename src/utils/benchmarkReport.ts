import type { BenchmarkRun } from './benchmarkRunner';

function timingColor(ms: number): string {
  if (ms < 500) return '#16a34a';
  if (ms < 2000) return '#d97706';
  return '#dc2626';
}

function statusColor(code: number | null): string {
  if (code === null) return '#6b7280';
  if (code >= 200 && code < 300) return '#16a34a';
  if (code >= 400 && code < 500) return '#d97706';
  return '#dc2626';
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function productThumb(imageUrl: string, title: string, price: string | number, url: string): string {
  const href = url && url !== '#' ? `href="${escapeHtml(url)}" target="_blank"` : '';
  const img = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="lazy"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
       /><div class="no-img" style="display:none">No image</div>`
    : `<div class="no-img">No image</div>`;
  return `
    <a class="thumb" ${href}>
      <div class="thumb-img">${img}</div>
      <div class="thumb-title">${escapeHtml(title)}</div>
      <div class="thumb-price">${escapeHtml(String(price))}</div>
    </a>`;
}

function configSummaryTable(overrides: Record<string, unknown>): string {
  const keys = Object.keys(overrides);
  if (keys.length === 0) return '<em style="color:#9ca3af">No overrides (base config)</em>';
  const rows = keys
    .map((k) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(JSON.stringify(overrides[k]))}</td></tr>`)
    .join('');
  return `<table class="override-table"><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function generateBenchmarkReport(run: BenchmarkRun): string {
  const { spec, cells, rowKeys, runAt } = run;
  const dateStr = runAt.toLocaleString();

  // Build per-row sections (rows = expanded query/profile combos, columns = configs)
  const rowSections = rowKeys
    .map((rowKey) => {
      const rowCells = spec.configurations.map((cfg) =>
        cells.find((c) => c.rowKey === rowKey && c.configName === cfg.name),
      );

      const firstCell = rowCells.find(Boolean);
      const hasAffinityProfile = !!firstCell?.affinityProfileName;

      const cols = rowCells
        .map((cell) => {
          if (!cell) return '<td class="cell"><em>No data</em></td>';
          const timColor = timingColor(cell.durationMs);
          const stColor = statusColor(cell.statusCode);
          const badges = `
            <div class="badges">
              <span class="badge" style="color:${timColor};border-color:${timColor}">${cell.durationMs}ms</span>
              <span class="badge" style="color:${stColor};border-color:${stColor}">${cell.statusCode ?? 'ERR'}</span>
              <span class="badge" style="color:#6b7280;border-color:#d1d5db">${cell.totalResults.toLocaleString()} results</span>
            </div>`;
          const content = cell.error
            ? `<div class="error-msg">⚠ ${escapeHtml(cell.error)}</div>`
            : `<div class="thumbs">${cell.products.map((p) => productThumb(p.imageUrl, p.title, p.price, p.url)).join('')}</div>`;
          return `<td class="cell">${badges}${content}</td>`;
        })
        .join('');

      const affinityLabel = hasAffinityProfile
        ? ` <span class="affinity-tag">persona: ${escapeHtml(firstCell!.affinityProfileName!)}</span>`
        : '';

      return `
        <section class="query-section">
          <h2 class="query-heading">
            Query: <span class="query-term">${escapeHtml(firstCell?.query ?? rowKey)}</span>${affinityLabel}
          </h2>
          <div class="table-wrap">
            <table class="result-table">
              <thead>
                <tr>
                  ${spec.configurations.map((cfg) => `<th><div class="cfg-name">${escapeHtml(cfg.name)}</div>${cfg.description ? `<div class="cfg-desc">${escapeHtml(cfg.description)}</div>` : ''}</th>`).join('')}
                </tr>
              </thead>
              <tbody><tr>${cols}</tr></tbody>
            </table>
          </div>
        </section>`;
    })
    .join('');

  // Config detail cards
  const configCards = spec.configurations
    .map(
      (cfg) => `
      <div class="config-card">
        <h3>${escapeHtml(cfg.name)}</h3>
        ${cfg.description ? `<p>${escapeHtml(cfg.description)}</p>` : ''}
        ${configSummaryTable(cfg.overrides as Record<string, unknown>)}
      </div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DY Search Benchmark — ${escapeHtml(dateStr)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; font-size: 13px; color: #111; background: #f9fafb; margin: 0; padding: 24px; }
    h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 4px; }
    .meta { color: #6b7280; font-size: 12px; margin-bottom: 32px; }
    h2.query-heading { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 12px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .query-term { color: #2563eb; }
    .affinity-tag { font-size: 11px; font-weight: 600; background: #ede9fe; color: #7c3aed; border-radius: 4px; padding: 2px 8px; text-transform: none; letter-spacing: 0; }
    .query-section { margin-bottom: 48px; }
    .table-wrap { overflow-x: auto; }
    .result-table { border-collapse: collapse; width: 100%; min-width: 400px; }
    .result-table th { background: #f3f4f6; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 10px 14px; text-align: left; border: 1px solid #e5e7eb; white-space: nowrap; min-width: 200px; }
    .cfg-name { font-size: 12px; font-weight: 700; }
    .cfg-desc { font-size: 11px; font-weight: 400; color: #6b7280; margin-top: 2px; }
    .cell { vertical-align: top; padding: 12px 14px; border: 1px solid #e5e7eb; background: #fff; min-width: 200px; }
    .badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
    .badge { font-size: 11px; font-weight: 600; border: 1px solid; border-radius: 4px; padding: 2px 6px; white-space: nowrap; }
    .thumbs { display: flex; flex-wrap: wrap; gap: 8px; }
    .thumb { display: flex; flex-direction: column; width: 80px; text-decoration: none; color: inherit; }
    .thumb-img { width: 80px; height: 107px; background: #f3f4f6; overflow: hidden; }
    .thumb-img img { width: 100%; height: 100%; object-fit: cover; }
    .no-img { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #9ca3af; }
    .thumb-title { font-size: 10px; margin-top: 4px; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .thumb-price { font-size: 10px; font-weight: 700; color: #374151; margin-top: 2px; }
    .error-msg { color: #dc2626; font-size: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 8px; }
    .configs-section { margin-bottom: 40px; }
    .configs-section h2 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }
    .config-cards { display: flex; gap: 16px; flex-wrap: wrap; }
    .config-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 14px 16px; min-width: 220px; flex: 1; }
    .config-card h3 { font-size: 13px; font-weight: 700; margin: 0 0 4px; }
    .config-card p { font-size: 12px; color: #6b7280; margin: 0 0 8px; }
    .override-table { border-collapse: collapse; font-size: 11px; width: 100%; margin-top: 6px; }
    .override-table th { background: #f3f4f6; text-align: left; padding: 4px 8px; font-weight: 600; border: 1px solid #e5e7eb; }
    .override-table td { padding: 4px 8px; border: 1px solid #e5e7eb; font-family: monospace; word-break: break-all; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 32px 0; }
  </style>
</head>
<body>
  <h1>DY Search Benchmark Report</h1>
  <p class="meta">Run at ${escapeHtml(dateStr)} &nbsp;·&nbsp; ${rowKeys.length} rows &nbsp;·&nbsp; ${spec.configurations.length} configurations &nbsp;·&nbsp; ${spec.itemsToShow ?? 6} products shown per cell</p>

  <div class="configs-section">
    <h2>Configurations</h2>
    <div class="config-cards">${configCards}</div>
  </div>

  <hr />

  ${rowSections}
</body>
</html>`;
}

export function downloadReport(run: BenchmarkRun): void {
  const html = generateBenchmarkReport(run);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const ts = run.runAt.toISOString().slice(0, 16).replace('T', '-').replace(':', '');
  const a = document.createElement('a');
  a.href = url;
  a.download = `benchmark-${ts}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

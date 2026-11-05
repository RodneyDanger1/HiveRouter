/**
 * INDEPENDENT Wave 7 auditor probe — server-side runs filter truth.
 * Uses an in-memory DB only. Does not touch the production DB.
 *
 * Run: node_modules\.bin\tsx.cmd docs\IMPROVE-WAVE-7\audit2\probe-runs.ts
 */
import { closeDb, getDb, initDb } from '../../../src/server/db/database.js';
import { createRunRow, listRuns, updateRun } from '../../../src/server/runs/recorder.js';
import { buildApp } from '../../../src/server/app.js';

initDb(':memory:', 'B2');

const report: Record<string, unknown> = {};
const db = getDb();

function seed(id: string, status: 'completed' | 'failed', createdAt: string): void {
  createRunRow({
    id,
    brief: 'wave7 runs-filter audit probe',
    preset: 'full-build',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: `workspace/runs/${id}`,
  });
  if (status === 'completed') {
    updateRun(id, { status: 'running', phase: 'intake' });
    updateRun(id, { status: 'completed', phase: 'done' });
  } else {
    updateRun(id, { status: 'failed', phase: 'done' });
  }
  db.prepare('UPDATE runs SET created_at = ? WHERE id = ?').run(createdAt, id);
}

// 120 newer completed rows; 30 older failed rows (all failed rows are outside
// the first 100 rows of the unfiltered list, which is the Wave 7 blind spot).
for (let i = 0; i < 120; i += 1) {
  seed(`probe_completed_${String(i).padStart(3, '0')}`, 'completed', new Date(Date.UTC(2026, 1, 1, 0, i, 0)).toISOString());
}
for (let i = 0; i < 30; i += 1) {
  seed(`probe_failed_${String(i).padStart(3, '0')}`, 'failed', new Date(Date.UTC(2026, 0, 1, 0, i, 0)).toISOString());
}

const unfiltered100 = listRuns(100);
const clientSideOld = unfiltered100.filter((r) => r.status === 'failed');
const serverFailed = listRuns(100, 'failed');
report.phase1 = {
  totalRows: (db.prepare('SELECT COUNT(*) AS n FROM runs').get() as { n: number }).n,
  unfiltered100: unfiltered100.length,
  unfiltered100Statuses: [...new Set(unfiltered100.map((r) => r.status))],
  oldClientSideFailedVisible: clientSideOld.length,
  serverFilteredFailed: serverFailed.length,
  serverFilteredAllFailedRows: serverFailed.every((r) => r.status === 'failed'),
  serverFilteredFailedIds: serverFailed.map((r) => r.id).slice(0, 3),
};

// Now push the failed population past the 100-row page cap.
for (let i = 30; i < 150; i += 1) {
  seed(`probe_failed_${String(i).padStart(3, '0')}`, 'failed', new Date(Date.UTC(2025, 11, 1, 0, i, 0)).toISOString());
}
const failedTotal = (db.prepare("SELECT COUNT(*) AS n FROM runs WHERE status = 'failed'").get() as { n: number }).n;
const failedPage = listRuns(100, 'failed');
report.phase2 = {
  failedRowsInDb: failedTotal,
  serverFilteredFailedPage: failedPage.length,
  rowsBeyondPageCap: failedTotal - failedPage.length,
  uiCountWouldRender: failedPage.length,
  serverFilteredAllFailedRows: failedPage.every((r) => r.status === 'failed'),
};

// Route-level truth, including URL-encoded and injection-shaped status values.
const app = await buildApp();
try {
  const cases: Array<[string, string]> = [
    ['all', '/api/runs?limit=100'],
    ['failed', '/api/runs?limit=100&status=failed'],
    ['completed', '/api/runs?limit=100&status=completed'],
    ['completed_with_warnings', '/api/runs?limit=100&status=completed_with_warnings'],
    ['encoded-space', '/api/runs?limit=100&status=completed%20with%20warnings'],
    ['injection-shaped', '/api/runs?limit=100&status=failed%26status%3Drunning'],
  ];
  const routes: Array<Record<string, unknown>> = [];
  for (const [name, url] of cases) {
    const response = await app.inject({ method: 'GET', url, headers: { host: '127.0.0.1:8787' } });
    const body = response.json() as { runs?: Array<{ status: string }>; total?: number };
    routes.push({
      name,
      url,
      statusCode: response.statusCode,
      rows: body.runs?.length ?? null,
      statuses: [...new Set((body.runs ?? []).map((r) => r.status))],
      responseKeys: Object.keys(body),
      hasTotal: typeof body.total === 'number',
      allRowsMatchFilter: name === 'all' ? undefined : (body.runs ?? []).every((r) => r.status === name || name.startsWith('encoded') || name === 'injection-shaped'),
    });
  }
  report.routes = routes;
} finally {
  await app.close();
}
closeDb();
console.log(JSON.stringify(report, null, 2));

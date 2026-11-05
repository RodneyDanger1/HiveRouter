/**
 * W6-AUD-02 logic audit — deterministic RED probes.
 *
 * Runs production modules against a THROWAWAY sqlite DB in %TEMP% and a Fastify
 * instance via app.inject() (no listen, no port, no restart, no provider call).
 * The production data/hive.db, workspace, vault and logs are never touched:
 * HIVE_* dirs are redirected before any server module is imported.
 *
 * Run:  node_modules\.bin\tsx.cmd docs\AUDIT-WAVE-6\logic\probe-routes.ts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-w6-logic-'));
process.env.HIVE_DATA_DIR = path.join(tmp, 'data');
process.env.HIVE_WORKSPACE_DIR = path.join(tmp, 'workspace');
process.env.HIVE_VAULT_DIR = path.join(tmp, 'vault');
process.env.HIVE_PHASE = 'B2';

const dbFile = path.join(tmp, 'hive.db');
const { initDb, getDb } = await import('../../../src/server/db/database.js');
const { createRunRow, emitEvent, getRun, updateRun, getEvents, lastEventId } =
  await import('../../../src/server/runs/recorder.js');
const { setExecutor, createRun, cancelRun } = await import('../../../src/server/runs/manager.js');
const budget = await import('../../../src/server/runs/budget.js');
const { LlmError } = await import('../../../src/server/llm/client.js');
const { transitionRun } = await import('../../../src/server/logic/run-state.js');
const { REFUSALS } = await import('../../../src/shared/refusals.js');
const { buildApp } = await import('../../../src/server/app.js');

const db = initDb(dbFile, 'B2');
const results: Array<{ probe: string; expected: string; actual: string; red: boolean }> = [];
function check(probe: string, expected: string, actual: string, red: boolean): void {
  results.push({ probe, expected, actual, red });
}
function workspaceFor(runId: string): string {
  const dir = path.join(tmp, 'workspace', 'runs', runId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function makeRun(id: string, status: 'queued' | 'completed' = 'queued') {
  createRunRow({
    id,
    brief: `probe ${id}`,
    preset: 'full-build',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: workspaceFor(id),
  });
  if (status === 'completed') updateRun(id, { status: 'completed', phase: 'done' });
}

// ---------------------------------------------------------------- seed runs ---
makeRun('run_probe_window', 'completed'); // 550 events -> >500 window
for (let i = 0; i < 550; i += 1) emitEvent('run_probe_window', 'phase.completed', { n: i });
makeRun('run_probe_small', 'completed'); // 20 events, first seq 551
for (let i = 0; i < 20; i += 1) emitEvent('run_probe_small', 'phase.started', { n: i });

const app = await buildApp();
const host = { host: '127.0.0.1:8787' };

// ---------------------------------------------- PROBE 1: truncated false + ---
{
  const big = await app.inject({ method: 'GET', url: '/api/runs/run_probe_window/events?after=0', headers: host });
  const bigBody = big.json() as { events: unknown[]; truncated: boolean };
  check(
    'events window: run with 550 events returns window and flags truncation',
    'truncated=true, events=500',
    `truncated=${bigBody.truncated}, events=${bigBody.events.length}`,
    !(bigBody.truncated === true && bigBody.events.length === 500),
  );

  const small = await app.inject({ method: 'GET', url: '/api/runs/run_probe_small/events?after=0', headers: host });
  const smallBody = small.json() as { events: unknown[]; truncated: boolean; lastEventId: number };
  const total = Number((db.prepare('SELECT COUNT(*) n FROM events WHERE run_id = ?').get('run_probe_small') as { n: number }).n);
  check(
    'events window: complete 20-event run must not claim truncation',
    `truncated=false, events=${total}, lastEventId=${lastEventId('run_probe_small')}`,
    `truncated=${smallBody.truncated}, events=${smallBody.events.length}, lastEventId=${smallBody.lastEventId}`,
    smallBody.truncated !== false,
  );
}

// ------------------------- PROBE 2: stale Last-Event-ID -> 410 loop source ---
{
  const res = await app.inject({
    method: 'GET',
    url: '/api/runs/run_probe_window/stream',
    headers: { ...host, 'last-event-id': '1' },
  });
  const body = res.json() as { error?: { code?: string } };
  check(
    'stream: stale Last-Event-ID is refused with a JSON refusal the EventSource client cannot read',
    'HTTP 410 with error.code=E_REPLAY_WINDOW_EXCEEDED (client only sees onerror)',
    `HTTP ${res.statusCode}, code=${body.error?.code}`,
    res.statusCode !== 410 || body.error?.code !== 'E_REPLAY_WINDOW_EXCEEDED',
  );
}

// ------------------------------ PROBE 3: the run-state guard is not wired ----
{
  const runId = 'run_probe_small';
  updateRun(runId, { status: 'completed', phase: 'done' });
  let mutated = false;
  try {
    updateRun(runId, { status: 'running', phase: 'intake' });
    mutated = getRun(runId)?.status === 'running';
  } catch {
    mutated = false;
  }
  check(
    'state guard: persistence layer rejects completed -> running',
    'throw E_ILLEGAL_RUN_TRANSITION / status stays completed',
    mutated ? 'status persisted as running (no guard)' : 'rejected',
    mutated,
  );
  let pureGuard = 'no throw';
  try {
    transitionRun({ runId, status: 'completed', phase: 'done' }, { status: 'running' } as never);
  } catch (error) {
    pureGuard = (error as { code?: string }).code ?? 'throw';
  }
  check(
    'state guard: pure transitionRun rejects completed -> running',
    'E_ILLEGAL_RUN_TRANSITION',
    pureGuard,
    pureGuard !== 'E_ILLEGAL_RUN_TRANSITION',
  );
  // put it back so later probes can create runs
  updateRun(runId, { status: 'completed', phase: 'done' });
}

// --------------------------- PROBE 4: provider error code is lost (E_INTERNAL) ---
{
  setExecutor(async () => {
    throw new LlmError('E_LLM_RATE_LIMIT', 'DeepSeek rate limit reached after 3 attempts.', 429, true);
  });
  const created = await createRun({
    brief: 'probe code loss',
    preset: 'full-build',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    idempotencyKey: `probe-code-loss-${Date.now()}`,
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const run = getRun(created.runId);
  const events = getEvents(created.runId, 0, 50);
  const terminal = events.find((event) => event.type === 'run.failed');
  check(
    'error propagation: LlmError E_LLM_RATE_LIMIT must persist its own code',
    'run.errorCode=E_LLM_RATE_LIMIT, event.code=E_LLM_RATE_LIMIT',
    `run.errorCode=${run?.errorCode}, event.code=${String(terminal?.payload.code)}, message=${String(run?.errorMessage)}`,
    run?.errorCode !== 'E_LLM_RATE_LIMIT' || terminal?.payload.code !== 'E_LLM_RATE_LIMIT',
  );
}

// ------------------------------ PROBE 5: failed run loses measured spend -------
{
  // Production evidence is in probe-db.mjs (run_abf5: 20 provider usage rows,
  // runs.cost_usd NULL). This probe proves the pipeline's failure branch never
  // writes usageTotals into the run row: create + fail, then show cost is null
  // even though a committed reservation exists.
  const runId = 'run_probe_cost';
  makeRun(runId, 'queued');
  updateRun(runId, { status: 'running', phase: 'generating' });
  const resId = `res_probe_${Date.now()}`;
  budget.reserve({ id: resId, scope: 'user', ownerRunId: runId, amountMicroUsd: 1000 });
  budget.commit(resId, 900);
  const totals = db.prepare('SELECT COALESCE(SUM(committed_micro_usd),0) c FROM budget_reservations WHERE owner_run_id = ?').get(runId) as { c: number };
  updateRun(runId, { status: 'failed', phase: 'done', error_code: 'GATE_FAILED', finished_at: new Date().toISOString() });
  const run = getRun(runId);
  check(
    'failure branch: a failed run keeps commit totals out of runs.cost_usd',
    'runs.cost_usd tracks committed spend (0.0009)',
    `committed=${Number(totals.c) / 1e6}, runs.cost_usd=${String(run?.costUsd)}`,
    run?.costUsd == null,
  );
}

// ------------------------------- PROBE 6: budget settlement idempotency ------
{
  const id = `res_idem_${Date.now()}`;
  budget.reserve({ id, scope: 'user', ownerRunId: 'run_probe_budget', amountMicroUsd: 2000 });
  budget.commit(id, 1500);
  let second = 'no throw';
  try {
    budget.commit(id, 1500);
  } catch (error) {
    second = (error as Error).message;
  }
  check('budget: double end-hook cannot settle twice', 'E_BUDGET_UNKNOWN_RESERVATION', second, second !== 'E_BUDGET_UNKNOWN_RESERVATION');

  const id2 = `res_over_${Date.now()}`;
  budget.reserve({ id: id2, scope: 'user', ownerRunId: 'run_probe_budget', amountMicroUsd: 1000 });
  let over = 'no throw';
  try {
    budget.commit(id2, 5000);
  } catch (error) {
    over = (error as Error).message;
  }
  const row = db.prepare('SELECT state, committed_micro_usd FROM budget_reservations WHERE id = ?').get(id2) as { state: string; committed_micro_usd: number };
  check(
    'budget: overcommit throws after recording the true cost (not rolled back)',
    'E_BUDGET_OVERCOMMIT and row committed=5000',
    `${over}, state=${row.state}, committed=${row.committed_micro_usd}`,
    over !== 'E_BUDGET_OVERCOMMIT' || row.state !== 'committed' || Number(row.committed_micro_usd) !== 5000,
  );

  const id3 = `res_rel_${Date.now()}`;
  budget.reserve({ id: id3, scope: 'user', ownerRunId: 'run_probe_budget', amountMicroUsd: 1000 });
  budget.commit(id3, 1000);
  budget.release(id3);
  const row3 = db.prepare('SELECT state FROM budget_reservations WHERE id = ?').get(id3) as { state: string };
  check(
    'budget: release() after commit is a silent no-op (state stays committed)',
    'no-op; state=committed (does not refund or error)',
    `state=${row3.state}`,
    row3.state === 'released',
  );
}

// ------------------------------ PROBE 7: named refusal set completeness ------
{
  const required = ['GATE_FAILED', 'E_CANCELLED', 'E_RUN_TIMEOUT', 'E_LLM_RATE_LIMIT', 'E_PROVIDER_EMPTY'];
  const missing = required.filter((code) => !(code in REFUSALS));
  check(
    'error registry: every code persisted on a run exists in REFUSALS',
    'all present',
    `missing=${missing.join(',') || 'none'}`,
    missing.length > 0,
  );
}

// ------------------------------------------------------- PROBE 8: idempotency -
{
  const key = `probe-idem-${Date.now()}`;
  setExecutor(async () => {
    /* keep the run active so the replay path is the only legal duplicate */
  });
  const first = await createRun({
    brief: 'probe idempotency',
    preset: 'full-build',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    idempotencyKey: key,
  });
  const replay = await createRun({
    brief: 'probe idempotency',
    preset: 'full-build',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    idempotencyKey: key,
  });
  check(
    'idempotency: identical replay returns the same run id',
    `runId=${first.runId}, replayed=true`,
    `runId=${replay.runId}, replayed=${replay.replayed}`,
    replay.runId !== first.runId || replay.replayed !== true,
  );
  let reuse = 'no throw';
  try {
    await createRun({
      brief: 'probe idempotency DIFFERENT',
      preset: 'full-build',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      idempotencyKey: key,
    });
  } catch (error) {
    reuse = (error as Error).message;
  }
  check('idempotency: same key + different body is refused', 'E_IDEMPOTENCY_KEY_REUSED', reuse, reuse !== 'E_IDEMPOTENCY_KEY_REUSED');

  const cancelled = cancelRun(first.runId);
  check(
    'cancel: aborting an executor that ignores the signal still reports cancelled=true',
    'cancelled run is persisted cancelled by cancelRun itself',
    `cancelled=${cancelled}, status=${getRun(first.runId)?.status}`,
    cancelled && getRun(first.runId)?.status !== 'cancelled',
  );
}

// ------------------------- PROBE 9: startup interrupt is a silent terminal ----
{
  const runId = 'run_probe_interrupt';
  makeRun(runId, 'queued');
  updateRun(runId, { status: 'running', phase: 'generating', started_at: new Date().toISOString() });
  const before = Number((db.prepare('SELECT COUNT(*) n FROM events WHERE run_id = ?').get(runId) as { n: number }).n);
  const managerModule = await import('../../../src/server/runs/manager.js');
  managerModule.markStartupInterrupted();
  const run = getRun(runId);
  const after = Number((db.prepare('SELECT COUNT(*) n FROM events WHERE run_id = ?').get(runId) as { n: number }).n);
  check(
    'startup interrupt: interrupted is a terminal status with a code, message and event',
    'error_code set, error_message set, at least one run event',
    `status=${run?.status}, error_code=${String(run?.errorCode)}, error_message=${String(run?.errorMessage)}, events=${after - before}`,
    run?.status === 'interrupted' && (!run?.errorCode || !run?.errorMessage || after === before),
  );
}

// ------------------------------------------------------------------- report ---
let reds = 0;
console.log(`\nTEMP DIR: ${tmp}\n`);
for (const r of results) {
  if (r.red) reds += 1;
  console.log(`${r.red ? 'RED  ' : 'green'} | ${r.probe}\n         expected: ${r.expected}\n         actual  : ${r.actual}`);
}
console.log(`\n${reds}/${results.length} probes are RED (a RED probe confirms a defect, it does not fail the harness).`);
await app.close();
db.close();
process.exitCode = 0;

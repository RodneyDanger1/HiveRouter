import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { getDb, nowIso, tx } from '../db/database.js';
import { createRunRow, getRun, updateRun, emitEvent, usageFields } from './recorder.js';
import { createSnapshot } from './snapshot.js';
import { canAfford, estimateCallMicroUsd, release, reserve, commit, releaseReservationsForRun } from './budget.js';
import { hashPrompt } from '../agents/registry.js';
import { recordError } from '../observability/error-log.js';
import { REFUSALS, codeOfError } from '../../shared/refusals.js';
import type { Effort, ModelId, Preset, RunStatus, ThinkingMode } from '../../shared/types.js';

/**
 * A terminal event must carry a human sentence, never a bare error code.
 * Registered refusals contribute their documented sentence; an unregistered
 * code (E_PROVIDER_EMPTY, E_RUN_TIMEOUT, E_CANCELLED, ...) gets a status-aware
 * sentence so the code is never presented as its own explanation.
 */
export function terminalEventMessage(code: string, rawMessage: string, outcome: 'failed' | 'cancelled'): string {
  if (rawMessage !== code) return rawMessage;
  const registered = REFUSALS[code as keyof typeof REFUSALS];
  if (registered) return registered.message;
  return outcome === 'cancelled' ? 'The run was cancelled.' : `The run failed with ${code}.`;
}

export interface RunContext {
  runId: string;
  signal: AbortSignal;
}

type Executor = (context: RunContext) => Promise<void>;

let executor: Executor | null = null;
const activeControllers = new Map<string, AbortController>();

export function setExecutor(fn: Executor): void {
  executor = fn;
}

export function getActiveRunId(): string | null {
  const row = getDb()
    .prepare("SELECT id FROM runs WHERE status IN ('queued','running','paused','needs_review') ORDER BY created_at ASC LIMIT 1")
    .get() as { id: string } | undefined;
  return row?.id ?? null;
}

export function createRunId(): string {
  return `run_${crypto.randomBytes(9).toString('hex')}`;
}

export function runWorkspace(runId: string): string {
  return path.join(config.workspaceDir, 'runs', runId);
}

export interface CreateRunInput {
  brief: string;
  preset: Preset;
  model: ModelId;
  thinking: ThinkingMode;
  effort: Effort | null;
  idempotencyKey: string;
  parentRunId?: string | null;
  runKind?: 'user' | 'revision' | 'audit' | 'adhoc' | 'resume';
  sourceRunId?: string | null;
  metadata?: Record<string, unknown>;
  maxCostUsd?: number;
}

export interface CreateRunResult {
  runId: string;
  replayed: boolean;
  status: number;
}

function bodyHash(input: CreateRunInput): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      brief: input.brief,
      preset: input.preset,
      model: input.model,
      thinking: input.thinking,
      effort: input.effort,
      parentRunId: input.parentRunId ?? null,
      sourceRunId: input.sourceRunId ?? null,
      runKind: input.runKind ?? 'user',
      metadata: input.metadata ?? null,
      maxCostUsd: input.maxCostUsd ?? null,
    }))
    .digest('hex');
}

export async function createRun(input: CreateRunInput): Promise<CreateRunResult> {
  if (!input.brief || input.brief.trim().length === 0) throw new Error('E_PROMPT_TOO_LARGE');
  if (input.brief.length > config.limits.briefChars) throw new Error('E_PROMPT_TOO_LARGE');
  if (!input.idempotencyKey || input.idempotencyKey.length < 16 || input.idempotencyKey.length > 128) throw new Error('E_IDEMPOTENCY_KEY_REQUIRED');
  if (input.maxCostUsd != null) {
    if (!Number.isFinite(input.maxCostUsd) || input.maxCostUsd <= 0) throw new Error('E_BUDGET_INVALID_LIMIT');
    if (input.maxCostUsd > config.limits.maxRunCostUsd) throw new Error('E_BUDGET_INVALID_LIMIT');
  }
  if (!executor) throw new Error('E_INTERNAL');

  const keyHash = crypto.createHash('sha256').update(input.idempotencyKey).digest('hex');
  const existing = getDb().prepare('SELECT * FROM idempotency_keys WHERE key_hash = ? AND expires_at > ?').get(keyHash, nowIso()) as Record<string, unknown> | undefined;
  if (existing) {
    if (String(existing.body_sha256) !== bodyHash(input)) throw new Error('E_IDEMPOTENCY_KEY_REUSED');
    const response = JSON.parse(String(existing.response_json)) as { runId: string };
    return { runId: response.runId, replayed: true, status: Number(existing.status) };
  }

  if (getActiveRunId()) throw new Error('E_ACTIVE_RUN_EXISTS');

  const id = createRunId();
  const workspace = runWorkspace(id);
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(path.join(workspace, '.staging'), { recursive: true });
  const run = createRunRow({
    id,
    brief: input.brief.trim(),
    preset: input.preset,
    model: input.model,
    thinking: input.thinking,
    effort: input.effort,
    workspacePath: workspace,
    parentRunId: input.parentRunId ?? null,
    runKind: input.runKind ?? 'user',
  });
  createSnapshot({ runId: id, model: input.model, thinking: input.thinking, effort: input.effort, preset: input.preset });
  if (input.maxCostUsd != null) {
    getDb()
      .prepare('INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at')
      .run(`run_limit:${id}`, JSON.stringify({ maxCostUsd: input.maxCostUsd }), nowIso());
  }
  if (input.metadata) {
    getDb()
      .prepare('INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at')
      .run(`run_meta:${id}`, JSON.stringify(input.metadata), nowIso());
  }
  const response = { runId: id };
  tx((db) => {
    // An expired idempotency key is not a replay; remove the stale row so the
    // primary-key insert below can succeed for a genuinely new request.
    db.prepare('DELETE FROM idempotency_keys WHERE key_hash = ? AND expires_at <= ?').run(keyHash, nowIso());
    db.prepare(
      'INSERT INTO idempotency_keys (key_hash, method, path, body_sha256, status, response_json, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(keyHash, 'POST', '/api/runs', bodyHash(input), 202, JSON.stringify(response), new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), nowIso());
  });
  emitEvent(id, 'run.queued', { runId: id, preset: run.preset });
  const controller = new AbortController();
  activeControllers.set(id, controller);
  const timeout = setTimeout(() => {
    controller.abort(new Error('E_RUN_TIMEOUT: run exceeded the configured wall-clock budget'));
  }, config.limits.runTimeoutMs);
  timeout.unref?.();
  queueMicrotask(() => {
    if (!executor) return;
    executor({ runId: id, signal: controller.signal })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const timedOut = controller.signal.reason instanceof Error && controller.signal.reason.message.startsWith('E_RUN_TIMEOUT');
        const code = timedOut ? 'E_RUN_TIMEOUT' : codeOfError(error);
        const usage = usageFields(id);
        recordError({ source: 'executor', code, message, runId: id });
        updateRun(id, {
          status: 'failed',
          phase: 'done',
          finished_at: nowIso(),
          error_code: code,
          error_message: message.slice(0, 2000),
          ...usage,
        });
        emitEvent(id, 'run.failed', { code, message: terminalEventMessage(code, message, 'failed').slice(0, 500), timedOut, costUsd: usage.cost_usd });
      })
      .finally(() => {
        clearTimeout(timeout);
        activeControllers.delete(id);
      });
  });
  return { runId: id, replayed: false, status: 202 };
}

export function cancelRun(runId: string): boolean {
  const run = getRun(runId);
  if (!run) throw new Error('E_RUN_NOT_FOUND');
  const controller = activeControllers.get(runId);
  if (controller) {
    controller.abort();
    return true;
  }
  // A needs_review / queued / paused run has no in-process controller. It must
  // still be cancellable, otherwise it blocks the one-active-run guard forever.
  if (['needs_review', 'queued', 'paused'].includes(run.status)) {
    const cancelMessage = 'Cancelled without an active controller.';
    releaseReservationsForRun(runId);
    const usage = usageFields(runId);
    updateRun(runId, {
      status: 'cancelled',
      phase: 'done',
      finished_at: nowIso(),
      error_code: 'E_CANCELLED',
      error_message: cancelMessage,
      ...usage,
    });
    emitEvent(runId, 'run.cancelled', { code: 'E_CANCELLED', source: 'no-controller', message: cancelMessage, costUsd: usage.cost_usd });
    return true;
  }
  return false;
}

export function markStartupInterrupted(): number {
  const db = getDb();
  const message = REFUSALS.E_RUN_INTERRUPTED.message;
  const active = db
    .prepare("SELECT id FROM runs WHERE status IN ('queued','running','paused','needs_review')")
    .all() as Array<{ id: string }>;
  let transitioned = 0;
  for (const row of active) {
    const usage = usageFields(row.id);
    // The guarded UPDATE is the transition: a run that became terminal between
    // the SELECT and this write is never downgraded, and only a row this call
    // actually transitioned gets an event, a log record and a budget release.
    const result = db
      .prepare(
        `UPDATE runs SET status = 'interrupted', phase = 'done', finished_at = ?, error_code = 'E_RUN_INTERRUPTED', error_message = ?,
           cost_usd = ?, prompt_tokens = ?, completion_tokens = ?
         WHERE id = ? AND status IN ('queued','running','paused','needs_review')`,
      )
      .run(nowIso(), message, usage.cost_usd, usage.prompt_tokens, usage.completion_tokens, row.id);
    if (Number(result.changes) !== 1) continue;
    transitioned += 1;
    emitEvent(row.id, 'run.interrupted', { code: 'E_RUN_INTERRUPTED', message, costUsd: usage.cost_usd });
    recordError({ source: 'run', code: 'E_RUN_INTERRUPTED', message, runId: row.id });
    // A crashed process cannot finish its in-flight calls; release their budget
    // leases now rather than leaving the money held until the 15-minute reaper.
    releaseReservationsForRun(row.id);
  }
  return transitioned;
}

export function reserveLlmCall(runId: string, promptChars: number, maxOutputTokens: number, model: string): string {
  const estimate = estimateCallMicroUsd(promptChars, maxOutputTokens, model);
  if (!canAfford(runId, estimate)) throw new Error('E_BUDGET_EXCEEDED');
  const id = `res_${crypto.randomBytes(8).toString('hex')}`;
  reserve({ id, scope: 'user', ownerRunId: runId, amountMicroUsd: estimate, ttlMs: 15 * 60 * 1000 });
  return id;
}

/**
 * Fit the requested output ceiling to the run's remaining cap. The provider is
 * then told this lower ceiling, so a worst-case reservation can never exceed
 * the cap; small test budgets fail safe rather than refusing a run that has
 * only spent a fraction of its budget.
 */
export function maxAffordableOutputTokens(
  runId: string,
  promptChars: number,
  requestedMaxTokens: number,
  model: string,
): number {
  const requested = Math.max(1, Math.floor(requestedMaxTokens));
  let candidate = requested;
  while (candidate > 512) {
    if (canAfford(runId, estimateCallMicroUsd(promptChars, candidate, model))) return candidate;
    candidate = Math.max(512, Math.floor(candidate * 0.75));
  }
  if (!canAfford(runId, estimateCallMicroUsd(promptChars, candidate, model))) {
    throw new Error('E_BUDGET_EXCEEDED');
  }
  return candidate;
}

export function commitLlmCall(id: string, actualUsd: number | null): void {
  commit(id, actualUsd == null ? null : Math.ceil(actualUsd * 1_000_000));
}

export function releaseLlmCall(id: string): void {
  release(id);
}

export function markRunning(runId: string): void {
  updateRun(runId, { status: 'running', phase: 'intake', started_at: nowIso() });
}

export function markTerminal(runId: string, status: RunStatus, phase: string, error?: { code?: string; message?: string }): void {
  updateRun(runId, {
    status,
    phase,
    finished_at: nowIso(),
    error_code: error?.code ?? null,
    error_message: error?.message ?? null,
    ...usageFields(runId),
  });
}

export function setTraceComplete(runId: string, complete: boolean): void {
  updateRun(runId, { trace_complete: complete ? 1 : 0 });
}

export function promptHashOf(text: string): string {
  return hashPrompt(text);
}

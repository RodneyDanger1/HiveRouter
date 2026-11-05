import { getDb, nowIso, tx } from '../db/database.js';
import { config } from '../config.js';

export type BudgetScope = 'user' | 'eval' | 'cycle';

export interface Reservation {
  id: string;
  scope: BudgetScope;
  ownerRunId: string | null;
  amountMicroUsd: number;
  state: 'reserved' | 'committed' | 'released';
  createdAt: string;
  expiresAt: string;
}

function micro(capUsd: number): number {
  return Math.round(capUsd * 1_000_000);
}

export function scopeCap(scope: BudgetScope, ownerRunId?: string | null): number {
  if (scope === 'eval') return micro(config.limits.evalCostUsd);
  if (scope === 'cycle') return micro(config.limits.cycleCostUsd);
  if (ownerRunId) {
    const row = getDb().prepare('SELECT value_json FROM settings WHERE key = ?').get(`run_limit:${ownerRunId}`) as { value_json: string } | undefined;
    if (row) {
      try {
        const parsed = JSON.parse(row.value_json) as { maxCostUsd?: number };
        if (typeof parsed.maxCostUsd === 'number' && Number.isFinite(parsed.maxCostUsd) && parsed.maxCostUsd > 0) {
          return Math.min(micro(config.limits.maxRunCostUsd), micro(parsed.maxCostUsd));
        }
      } catch {
        // fall back to the configured cap; the create path validates the stored limit
      }
    }
  }
  return micro(config.limits.maxRunCostUsd);
}

/**
 * The effective per-run budget in USD. Routing must use this, not the global
 * MAX_RUN_COST_USD, or it can allocate a plan the run cannot afford before the
 * first provider call.
 */
export function runBudgetUsd(runId: string): number {
  return scopeCap('user', runId) / 1_000_000;
}

export function reserve(input: {
  id: string;
  scope: BudgetScope;
  ownerRunId: string | null;
  amountMicroUsd: number;
  ttlMs?: number;
}): Reservation {
  if (!Number.isInteger(input.amountMicroUsd) || input.amountMicroUsd <= 0) throw new Error('E_BUDGET_INVALID_AMOUNT');
  const ttl = input.ttlMs ?? 15 * 60 * 1000;
  return tx((db) => {
    const existing = db.prepare('SELECT id FROM budget_reservations WHERE id = ?').get(input.id);
    if (existing) throw new Error('E_BUDGET_DUPLICATE_RESERVATION');
    const active = input.scope === 'user' && input.ownerRunId
      ? (db
          .prepare("SELECT COALESCE(SUM(CASE WHEN state = 'committed' THEN COALESCE(committed_micro_usd, amount_micro_usd) ELSE amount_micro_usd END),0) AS total FROM budget_reservations WHERE scope = ? AND owner_run_id = ? AND state IN ('reserved','committed')")
          .get(input.scope, input.ownerRunId) as { total: number })
      : (db
          .prepare("SELECT COALESCE(SUM(CASE WHEN state = 'committed' THEN COALESCE(committed_micro_usd, amount_micro_usd) ELSE amount_micro_usd END),0) AS total FROM budget_reservations WHERE scope = ? AND state IN ('reserved','committed')")
          .get(input.scope) as { total: number });
    const cap = scopeCap(input.scope, input.ownerRunId);
    if (Number(active.total) + input.amountMicroUsd > cap) throw new Error('E_BUDGET_EXCEEDED');
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + ttl).toISOString();
    db.prepare(
      'INSERT INTO budget_reservations (id, scope, owner_run_id, amount_micro_usd, state, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(input.id, input.scope, input.ownerRunId, input.amountMicroUsd, 'reserved', createdAt, expiresAt);
    return {
      id: input.id,
      scope: input.scope,
      ownerRunId: input.ownerRunId,
      amountMicroUsd: input.amountMicroUsd,
      state: 'reserved',
      createdAt,
      expiresAt,
    };
  });
}

export function commit(id: string, actualMicroUsd: number | null): void {
  if (actualMicroUsd != null && (!Number.isInteger(actualMicroUsd) || actualMicroUsd < 0)) throw new Error('E_BUDGET_INVALID_AMOUNT');
  let overcommitted = false;
  tx((db) => {
    const row = db.prepare('SELECT * FROM budget_reservations WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) throw new Error('E_BUDGET_UNKNOWN_RESERVATION');
    if (String(row.state) !== 'reserved') throw new Error('E_BUDGET_UNKNOWN_RESERVATION');
    const reserved = Number(row.amount_micro_usd);
    if (actualMicroUsd != null && actualMicroUsd > reserved) overcommitted = true;
    db.prepare("UPDATE budget_reservations SET state = 'committed', committed_micro_usd = ? WHERE id = ?").run(actualMicroUsd ?? reserved, id);
  });
  // Record the actual overrun before failing the caller; the throw is outside the
  // transaction so the committed row is not rolled back with it.
  if (overcommitted) throw new Error('E_BUDGET_OVERCOMMIT');
}

export function release(id: string): void {
  tx((db) => {
    db.prepare("UPDATE budget_reservations SET state = 'released' WHERE id = ? AND state = 'reserved'").run(id);
  });
}

export function reapExpired(): number {
  return tx((db) => {
    const result = db.prepare("UPDATE budget_reservations SET state = 'released' WHERE state = 'reserved' AND expires_at < ?").run(nowIso());
    return Number(result.changes);
  });
}

export function spentMicro(runId: string): number {
  const row = getDb()
    .prepare("SELECT COALESCE(SUM(committed_micro_usd),0) AS total FROM budget_reservations WHERE owner_run_id = ? AND state = 'committed'")
    .get(runId) as { total: number };
  return Number(row.total);
}

export function canAfford(runId: string, estimateMicroUsd: number): boolean {
  const row = getDb()
    .prepare("SELECT COALESCE(SUM(CASE WHEN state = 'committed' THEN COALESCE(committed_micro_usd, amount_micro_usd) ELSE amount_micro_usd END),0) AS total FROM budget_reservations WHERE owner_run_id = ? AND state IN ('reserved','committed')")
    .get(runId) as { total: number };
  return Number(row.total) + estimateMicroUsd <= scopeCap('user', runId);
}

/** Release every still-held reservation for a run that was interrupted on restart. */
export function releaseReservationsForRun(runId: string): number {
  return tx((db) => {
    const result = db.prepare("UPDATE budget_reservations SET state = 'released' WHERE owner_run_id = ? AND state = 'reserved'").run(runId);
    return Number(result.changes);
  });
}

export function estimateCallMicroUsd(promptChars: number, maxOutputTokens: number, model: string): number {
  const inputTokens = Math.ceil(promptChars / 3);
  const pricing = config.pricing[model as keyof typeof config.pricing] ?? config.pricing['deepseek-flash'];
  const inputUsd = (inputTokens / 1_000_000) * pricing.cacheMissPeak;
  const outputUsd = (maxOutputTokens / 1_000_000) * pricing.outputPeak;
  return Math.ceil((inputUsd + outputUsd) * 1_000_000);
}

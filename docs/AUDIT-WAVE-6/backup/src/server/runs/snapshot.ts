import crypto from 'node:crypto';
import { getDb, nowIso, tx } from '../db/database.js';
import { config } from '../config.js';
import { REGISTRY, capabilities } from '../agents/registry.js';
import { buildSystemPrompt, runtimeContract } from '../agents/prompts.js';
import type { Effort, ModelId, Preset, RunSnapshot, ThinkingMode } from '../../shared/types.js';

export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(v as Record<string, unknown>).sort()) out[key] = sort((v as Record<string, unknown>)[key]);
      return out;
    }
    return v;
  };
  return JSON.stringify(sort(value));
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function createSnapshot(input: {
  runId: string;
  model: ModelId;
  thinking: ThinkingMode;
  effort: Effort | null;
  preset: Preset;
}): RunSnapshot {
  return tx((db) => {
    const createdAt = nowIso();
    const promptVersions = REGISTRY.map((agent) => {
      const overrideRow = db.prepare('SELECT value_json FROM settings WHERE key = ?').get(`prompt_override:${agent.id}`) as { value_json: string } | undefined;
      let override = '';
      if (overrideRow) {
        try {
          const parsed = JSON.parse(overrideRow.value_json) as { prompt?: string };
          if (typeof parsed.prompt === 'string' && parsed.prompt.trim().length > 0) override = parsed.prompt.trim();
        } catch {
          override = '';
        }
      }
      const text = override ? `${override}${runtimeContract(agent.outputKind)}` : buildSystemPrompt(agent);
      const hash = sha256(text);
      db.prepare(
        'INSERT INTO prompt_versions (id, agent_id, version, hash, text, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(agent_id, hash) DO NOTHING',
      ).run(`pmt_${crypto.randomBytes(8).toString('hex')}`, agent.id, agent.promptVersion, hash, text, createdAt);
      return { agentId: agent.id, version: agent.promptVersion, hash, text };
    });
    const policyJson = canonicalJson({
      model: input.model,
      thinking: input.thinking,
      effort: input.effort,
      preset: input.preset,
      limits: config.limits,
      pricing: config.pricing,
      capabilities: capabilities(),
      enginePrecedence: ['engineHint', 'duty/content', 'path', 'fallback', 'polyglot'],
    });
    const policyHash = sha256(policyJson);
    const policyId = `pol_${crypto.randomBytes(8).toString('hex')}`;
    db.prepare(
      'INSERT INTO policy_versions (id, version, hash, json, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(hash) DO NOTHING',
    ).run(policyId, '2026-11-03.1', policyHash, policyJson, createdAt);
    const storedPolicy = db.prepare('SELECT id FROM policy_versions WHERE hash = ?').get(policyHash) as { id: string };
    const snapshotId = `snap_${crypto.randomBytes(8).toString('hex')}`;
    const body = {
      id: snapshotId,
      runId: input.runId,
      createdAt,
      model: input.model,
      thinking: input.thinking,
      effort: input.effort ?? undefined,
      preset: input.preset,
      limits: config.limits,
      pricing: config.pricing,
      engineMap: Object.fromEntries(REGISTRY.flatMap((a) => a.pathGlobs.map((g) => [g, a.id]))),
      promptVersions,
      policyVersion: { id: storedPolicy.id, version: '2026-11-03.1', hash: policyHash, json: policyJson },
      capabilities: capabilities(),
    };
    const hash = sha256(canonicalJson(body));
    const snapshot: RunSnapshot = { ...body, hash };
    db.prepare('INSERT INTO run_snapshots (id, run_id, snapshot_hash, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?)').run(
      snapshotId,
      input.runId,
      hash,
      canonicalJson(snapshot),
      createdAt,
    );
    db.prepare('UPDATE runs SET snapshot_hash = ?, policy_version_id = ? WHERE id = ?').run(hash, storedPolicy.id, input.runId);
    return snapshot;
  });
}

export function getSnapshot(runId: string): RunSnapshot | null {
  const row = getDb().prepare('SELECT snapshot_json FROM run_snapshots WHERE run_id = ?').get(runId) as { snapshot_json: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.snapshot_json) as RunSnapshot;
  } catch {
    return null;
  }
}

import crypto from 'node:crypto';
import { z } from 'zod';
import type { RefusalCode } from '../../shared/refusals';

/**
 * LG3 — deterministic repair planner.
 *
 * Converts normalized verification failures into at most five accepted repair
 * actions. It never calls an agent and never writes a file. The caller supplies
 * the explicit file→owner table; unknown ownership becomes a manual action.
 */

export const REPAIR_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type RepairSeverity = (typeof REPAIR_SEVERITIES)[number];

export const RepairFailureSchema = z.object({
  checkId: z.string().min(1).max(128),
  code: z.string().min(1).max(128),
  file: z.string().min(1).max(1024),
  line: z.number().int().positive().optional(),
  severity: z.enum(REPAIR_SEVERITIES),
  signature: z.string().min(1).max(128).optional(),
  message: z.string().max(2000).optional(),
});
export type RepairFailure = z.infer<typeof RepairFailureSchema>;

export const RepairContextSchema = z
  .object({
    attempts: z.number().int().min(0).max(100),
    maxAttempts: z.number().int().min(0).max(100),
    maxActions: z.number().int().min(1).max(5).default(5),
    lastSignature: z.string().max(128).nullable().default(null),
    fileOwners: z.record(z.string(), z.string().min(1).max(128)).default({}),
    fileDepth: z.record(z.string(), z.number().int().min(0).max(64)).default({}),
  })
  .refine((ctx) => ctx.attempts <= ctx.maxAttempts, {
    message: 'attempts must not exceed maxAttempts',
  });
export type RepairContext = z.input<typeof RepairContextSchema>;

export const RepairActionSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(['regenerate', 'patch', 'add_test', 'manual']),
  file: z.string().min(1).max(1024),
  agentId: z.string().min(1).max(128).nullable(),
  signature: z.string().regex(/^[a-f0-9]{64}$/),
  reason: z.string().min(1).max(512),
  priority: z.number().int(),
});
export type RepairAction = z.infer<typeof RepairActionSchema>;

export const REPAIR_PLAN_CODES = [
  'E_REPAIR_BUDGET_EXHAUSTED',
  'E_REPAIR_NO_STRATEGY',
  'E_REPAIR_UNSAFE_TARGET',
  'E_REPAIR_STALLED',
] as const;
export type RepairPlanCode = (typeof REPAIR_PLAN_CODES)[number];

export const RepairPlanSchema = z.object({
  status: z.enum(['planned', 'exhausted', 'nothing_to_repair']),
  actions: z.array(RepairActionSchema).max(5),
  suppressed: z.number().int().min(0),
  planSignature: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  code: z.enum(REPAIR_PLAN_CODES).nullable(),
  reasons: z.array(z.string().max(512)).max(50),
});
export type RepairPlan = z.infer<typeof RepairPlanSchema>;

const SEVERITY_RANK: Record<RepairSeverity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

const RESERVED_WINDOWS_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** Lexical only: no filesystem access, no symlink check. */
export function normalizeRepairPath(input: string): string | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > 1024) return null;
  if (input.includes('\0') || input.includes(':') || input.includes('\\')) {
    // Allow backslashes to be normalized first, but reject drive/ADS colons.
    if (input.includes(':') || input.includes('\0')) return null;
  }
  const normalized = input.replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) return null;
  const parts = normalized.split('/');
  if (parts.some((p) => p === '' || p === '.' || p === '..')) return null;
  if (parts.length > 8) return null;
  const base = parts[parts.length - 1] ?? '';
  if (RESERVED_WINDOWS_NAME.test(base) || /[. ]$/.test(base)) return null;
  if (/[*?"<>|]/.test(normalized)) return null;
  return normalized;
}

function failureSignature(failure: RepairFailure, path: string): string {
  if (failure.signature) return failure.signature;
  return crypto
    .createHash('sha256')
    .update(`${failure.checkId}|${failure.code}|${path}`)
    .digest('hex');
}

function planSignatureFor(signatures: string[]): string | null {
  if (signatures.length === 0) return null;
  return crypto
    .createHash('sha256')
    .update([...signatures].sort().join('|'))
    .digest('hex');
}

function actionKind(failure: RepairFailure, owner: string | null): RepairAction['kind'] {
  if (!owner) return 'manual';
  if (failure.checkId.includes('test') || owner === 'gatekeeper') return 'add_test';
  if (owner === 'cleaner' || owner === 'sentinel' || owner === 'watchman') return 'patch';
  return 'regenerate';
}

/**
 * Plan repairs. Attempt accounting is the caller's responsibility: pass the
 * number of repairs already spent and the previous plan signature. A repeated
 * plan signature is stalled; no third blind attempt is emitted.
 */
export function planRepair(
  failuresInput: RepairFailure[],
  contextInput: RepairContext,
): RepairPlan {
  const failures = z.array(RepairFailureSchema).max(5000).parse(failuresInput);
  const context = RepairContextSchema.parse(contextInput);

  if (failures.length === 0) {
    return RepairPlanSchema.parse({
      status: 'nothing_to_repair',
      actions: [],
      suppressed: 0,
      planSignature: null,
      code: null,
      reasons: ['No failures supplied.'],
    });
  }

  if (context.attempts >= context.maxAttempts) {
    return RepairPlanSchema.parse({
      status: 'exhausted',
      actions: [],
      suppressed: 0,
      planSignature: null,
      code: 'E_REPAIR_BUDGET_EXHAUSTED',
      reasons: [
        `Repair attempts exhausted: ${context.attempts}/${context.maxAttempts}.`,
      ],
    });
  }

  const candidates: Array<RepairAction & { severityRank: number; depth: number }> = [];
  const seen = new Set<string>();
  let suppressed = 0;
  let unsafe = 0;

  for (const failure of failures) {
    const path = normalizeRepairPath(failure.file);
    if (!path) {
      unsafe += 1;
      continue;
    }
    const signature = failureSignature(failure, path);
    if (seen.has(signature)) {
      suppressed += 1;
      continue;
    }
    seen.add(signature);
    const owner = context.fileOwners[path] ?? null;
    const depth = context.fileDepth[path] ?? 0;
    const kind = actionKind(failure, owner);
    candidates.push({
      id: `repair-${signature.slice(0, 12)}`,
      kind,
      file: path,
      agentId: owner,
      signature,
      reason: `${failure.checkId}/${failure.code}: ${failure.message ?? 'repair required'}`,
      priority: SEVERITY_RANK[failure.severity] * 100 + depth,
      severityRank: SEVERITY_RANK[failure.severity],
      depth,
    });
  }

  if (candidates.length === 0) {
    return RepairPlanSchema.parse({
      status: 'exhausted',
      actions: [],
      suppressed,
      planSignature: null,
      code: 'E_REPAIR_UNSAFE_TARGET',
      reasons: [
        unsafe > 0
          ? `${unsafe} failure target(s) failed lexical path safety.`
          : 'No repair candidates survived filtering.',
      ],
    });
  }

  candidates.sort((a, b) => {
    if (a.severityRank !== b.severityRank) return b.severityRank - a.severityRank;
    if (a.depth !== b.depth) return b.depth - a.depth;
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    return a.signature < b.signature ? -1 : 1;
  });

  const selected = candidates.slice(0, context.maxActions);
  suppressed += candidates.length - selected.length;
  const sigs = selected.map((a) => a.signature);
  const planSignature = planSignatureFor(sigs);

  if (context.lastSignature && planSignature === context.lastSignature) {
    return RepairPlanSchema.parse({
      status: 'exhausted',
      actions: [],
      suppressed,
      planSignature,
      code: 'E_REPAIR_STALLED',
      reasons: ['The repair plan signature is unchanged; another blind attempt is forbidden.'],
    });
  }

  return RepairPlanSchema.parse({
    status: 'planned',
    actions: selected.map((a) => ({
      id: a.id,
      kind: a.kind,
      file: a.file,
      agentId: a.agentId,
      signature: a.signature,
      reason: a.reason,
      priority: a.priority,
    })),
    suppressed,
    planSignature,
    code: null,
    reasons:
      selected.length > 0
        ? [`${selected.length} repair action(s) planned; ${suppressed} suppressed.`]
        : ['No repair action was selected.'],
  });
}

export const REPAIR_REFUSAL_CODES = REPAIR_PLAN_CODES as readonly RefusalCode[];
export { SEVERITY_RANK as REPAIR_SEVERITY_RANK };

import crypto from 'node:crypto';
import { z } from 'zod';
import type { RefusalCode } from '../../shared/refusals';
import type { GateDecision } from '../../shared/types';

/**
 * LG1 — deterministic gate decision engine.
 *
 * Precedence is fixed: cancelled > failed > unverified > budget > warn > pass.
 * The engine never treats a failed or unverified mandatory check as a pass.
 * Signature covers only sorted `id:status:code` records plus the policy version,
 * so details, paths, line numbers, and timestamps cannot destabilize it.
 */

export const GATE_POLICY_NAMES = ['strict', 'normal', 'permissive'] as const;
export type GatePolicyName = (typeof GATE_POLICY_NAMES)[number];

export const GATE_OUTCOMES = [
  'cancelled',
  'failed',
  'unverified',
  'budget_exceeded',
  'pass_with_warnings',
  'pass',
] as const;
export type GateOutcome = (typeof GATE_OUTCOMES)[number];

export const CHECK_STATUSES = ['pass', 'fail', 'warn', 'unverified', 'skipped'] as const;
export type GateCheckStatus = (typeof CHECK_STATUSES)[number];

export const GateCheckSchema = z.object({
  id: z.string().min(1).max(128),
  status: z.enum(CHECK_STATUSES),
  mandatory: z.boolean(),
  code: z.string().min(1).max(128).optional(),
  detail: z.string().max(2000).optional(),
  file: z.string().max(1024).optional(),
  line: z.number().int().positive().optional(),
});
export type GateCheck = z.infer<typeof GateCheckSchema>;

export const GatePolicySchema = z.object({
  name: z.enum(GATE_POLICY_NAMES),
  version: z.string().min(1).max(64).default('gate-v1'),
});
export type GatePolicy = z.infer<typeof GatePolicySchema>;

export const GateRiskSchema = z.object({
  cancelled: z.boolean().default(false),
  budgetExceeded: z.boolean().default(false),
  criticalFindings: z.number().int().min(0).max(1_000_000).default(0),
});
export type GateRisk = z.infer<typeof GateRiskSchema>;

export const GateRepairContextSchema = z.object({
  attempts: z.number().int().min(0).max(100).default(0),
  maxRepairs: z.number().int().min(0).max(100).default(2),
  lastSignature: z.string().max(128).nullable().default(null),
});
export type GateRepairContext = z.infer<typeof GateRepairContextSchema>;

export const GateInputSchema = z.object({
  checks: z.array(GateCheckSchema).max(5000),
  policy: GatePolicySchema,
  risk: GateRiskSchema,
  repair: GateRepairContextSchema,
});
export type GateInput = z.input<typeof GateInputSchema>;

export const GateReasonSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(['critical', 'error', 'warning', 'info']),
  checkId: z.string().nullable(),
  message: z.string().min(1),
});
export type GateReason = z.infer<typeof GateReasonSchema>;

export const GateActionSchema = z.enum(['stop', 'repair', 'finalize', 'write_manifest']);
export type GateAction = z.infer<typeof GateActionSchema>;

export const GateDecisionSchema = z.object({
  status: z.enum(GATE_OUTCOMES),
  reasons: z.array(GateReasonSchema),
  actions: z.array(GateActionSchema).min(1),
  repairEligible: z.boolean(),
  signature: z.string().regex(/^[a-f0-9]{64}$/),
  policyName: z.enum(GATE_POLICY_NAMES),
  policyVersion: z.string().min(1),
  refusal: z.string().nullable(),
});
export type GateDecisionResult = z.infer<typeof GateDecisionSchema>;

export class GateDecisionError extends Error {
  readonly code: RefusalCode;

  constructor(code: 'E_GATE_POLICY_INVALID' | 'E_GATE_CONTRADICTION', message: string) {
    super(`${code}: ${message}`);
    this.name = 'GateDecisionError';
    this.code = code;
  }
}

const SEVERITY_RANK: Record<GateCheckStatus, number> = {
  fail: 5,
  unverified: 4,
  skipped: 3,
  warn: 2,
  pass: 1,
};

function sortedChecks(checks: GateCheck[]): GateCheck[] {
  return [...checks].sort((a, b) => {
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    if (a.status !== b.status) return a.status < b.status ? -1 : 1;
    return (a.code ?? '').localeCompare(b.code ?? '');
  });
}

export function gateSignature(checks: GateCheck[], policyVersion: string): string {
  const payload = sortedChecks(checks)
    .map((c) => `${c.id}:${c.status}:${c.code ?? '-'}`)
    .join('|');
  return crypto
    .createHash('sha256')
    .update(`${policyVersion}\n${payload}`)
    .digest('hex');
}

function reason(
  code: string,
  severity: GateReason['severity'],
  checkId: string | null,
  message: string,
): GateReason {
  return { code, severity, checkId, message };
}

/**
 * Compute one gate decision. Input is parsed by Zod at the boundary; every
 * branch is deterministic and total for valid inputs.
 */
export function decideGate(input: GateInput): GateDecisionResult {
  let parsed: z.output<typeof GateInputSchema>;
  try {
    parsed = GateInputSchema.parse(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'gate input rejected';
    throw new GateDecisionError('E_GATE_POLICY_INVALID', message);
  }

  if (parsed.repair.attempts > parsed.repair.maxRepairs) {
    throw new GateDecisionError(
      'E_GATE_CONTRADICTION',
      `repair attempts (${parsed.repair.attempts}) exceed maxRepairs (${parsed.repair.maxRepairs})`,
    );
  }

  const ids = new Set<string>();
  for (const check of parsed.checks) {
    if (ids.has(check.id)) {
      throw new GateDecisionError(
        'E_GATE_CONTRADICTION',
        `duplicate check id in gate input: ${check.id}`,
      );
    }
    ids.add(check.id);
  }

  const checks = sortedChecks(parsed.checks);
  const signature = gateSignature(checks, parsed.policy.version);
  const reasons: GateReason[] = [];

  const failed = checks.filter((c) => c.status === 'fail');
  const mandatoryUnverified = checks.filter(
    (c) => c.mandatory && (c.status === 'unverified' || c.status === 'skipped'),
  );
  const warningChecks = checks.filter(
    (c) => c.status === 'warn' || (!c.mandatory && c.status === 'skipped'),
  );
  const strictWarning = parsed.policy.name === 'strict' && warningChecks.length > 0;
  const critical = parsed.risk.criticalFindings > 0;

  // 1. cancelled
  if (parsed.risk.cancelled) {
    reasons.push(reason('GATE_CANCELLED', 'warning', null, 'Run was cancelled.'));
    return decision('cancelled', reasons, ['stop'], false, signature, parsed, null);
  }

  // 2. failed (any failure, a risk-critical finding, or a strict warning)
  if (failed.length > 0 || critical || strictWarning) {
    for (const check of failed) {
      reasons.push(
        reason(
          'GATE_CHECK_FAILED',
          'critical',
          check.id,
          `Check ${check.id} failed${check.code ? ` (${check.code})` : ''}.`,
        ),
      );
    }
    if (critical) {
      reasons.push(
        reason(
          'GATE_CRITICAL_FINDING',
          'critical',
          null,
          `${parsed.risk.criticalFindings} critical finding(s) were reported.`,
        ),
      );
    }
    if (strictWarning) {
      for (const check of warningChecks) {
        reasons.push(
          reason(
            'GATE_WARNING_STRICT',
            'error',
            check.id,
            `Strict policy treats ${check.status} as a failure.`,
          ),
        );
      }
    }

    const exhausted = parsed.repair.attempts >= parsed.repair.maxRepairs;
    const stalled = parsed.repair.lastSignature !== null && parsed.repair.lastSignature === signature;
    if (exhausted) {
      reasons.push(
        reason(
          'GATE_REPAIR_BUDGET_EXHAUSTED',
          'error',
          null,
          `Repair budget exhausted after ${parsed.repair.attempts} attempt(s).`,
        ),
      );
    } else if (stalled) {
      reasons.push(
        reason(
          'GATE_REPAIR_STALLED',
          'error',
          null,
          'The same failure signature repeated; another blind repair is forbidden.',
        ),
      );
    }
    const repairEligible = !exhausted && !stalled;
    const refusal = exhausted
      ? 'E_REPAIR_BUDGET_EXHAUSTED'
      : stalled
        ? 'E_REPAIR_STALLED'
        : null;
    return decision(
      'failed',
      reasons,
      repairEligible ? ['repair'] : ['stop'],
      repairEligible,
      signature,
      parsed,
      refusal,
    );
  }

  // 3. unverified (mandatory unverified/skipped, or no checks at all)
  if (checks.length === 0) {
    reasons.push(
      reason('GATE_NO_CHECKS', 'error', null, 'No checks were supplied; a vacuous pass is forbidden.'),
    );
    return decision('unverified', reasons, ['stop'], false, signature, parsed, null);
  }
  if (mandatoryUnverified.length > 0) {
    for (const check of mandatoryUnverified) {
      reasons.push(
        reason(
          'GATE_UNVERIFIED',
          'error',
          check.id,
          `Mandatory check ${check.id} was ${check.status}, not pass.`,
        ),
      );
    }
    return decision('unverified', reasons, ['stop'], false, signature, parsed, null);
  }

  // 4. budget (after cancelled/failed/unverified)
  if (parsed.risk.budgetExceeded) {
    reasons.push(
      reason('GATE_BUDGET_EXCEEDED', 'error', null, 'The run stopped at its budget cap.'),
    );
    return decision('budget_exceeded', reasons, ['stop'], false, signature, parsed, 'E_BUDGET_EXCEEDED');
  }

  // 5. warn / pass
  for (const check of warningChecks) {
    reasons.push(
      reason(
        check.status === 'skipped' ? 'GATE_SKIPPED_OPTIONAL' : 'GATE_WARNING',
        'warning',
        check.id,
        check.status === 'skipped'
          ? `Optional check ${check.id} was skipped.`
          : `Check ${check.id} produced a warning.`,
      ),
    );
  }

  const outcome: GateOutcome =
    warningChecks.length === 0
      ? 'pass'
      : parsed.policy.name === 'permissive'
        ? 'pass'
        : 'pass_with_warnings';

  if (outcome === 'pass') {
    reasons.push(reason('GATE_PASS', 'info', null, 'All mandatory checks passed.'));
  }
  return decision(
    outcome,
    reasons,
    ['finalize', 'write_manifest'],
    false,
    signature,
    parsed,
    null,
  );
}

function decision(
  status: GateOutcome,
  reasons: GateReason[],
  actions: GateAction[],
  repairEligible: boolean,
  signature: string,
  parsed: z.output<typeof GateInputSchema>,
  refusal: string | null,
): GateDecisionResult {
  const stableReasons = [...reasons].sort((a, b) => {
    if (a.code !== b.code) return a.code < b.code ? -1 : 1;
    return (a.checkId ?? '').localeCompare(b.checkId ?? '');
  });
  return GateDecisionSchema.parse({
    status,
    reasons: stableReasons,
    actions,
    repairEligible,
    signature,
    policyName: parsed.policy.name,
    policyVersion: parsed.policy.version,
    refusal,
  });
}

/** Compatibility adapter for call sites that still use the three-state type. */
export function toLegacyGateDecision(result: GateDecisionResult): GateDecision {
  const status: GateDecision['status'] =
    result.status === 'pass'
      ? 'pass'
      : result.status === 'pass_with_warnings'
        ? 'pass_with_warnings'
        : 'fail';
  return {
    status,
    reasons: result.reasons.map((r) => `${r.code}${r.checkId ? `:${r.checkId}` : ''}`),
    actions: [...result.actions],
    repairEligible: result.repairEligible,
    signature: result.signature,
  };
}

/** Exposed for tests/tools that need the ordered status precedence without parsing. */
export const GATE_PRECEDENCE: readonly GateOutcome[] = GATE_OUTCOMES;
export const CHECK_SEVERITY_RANK = SEVERITY_RANK;

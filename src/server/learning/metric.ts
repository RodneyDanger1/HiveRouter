import type { CheckResult } from '../../shared/types.js';

export interface GatePassInput {
  checks: CheckResult[];
  plannedFiles: string[];
  generatedFiles: string[];
  criticalSafety: boolean;
  syntaxPass: boolean;
}

export interface GatePassResult {
  pass: boolean;
  mandatoryChecks: number;
  failedMandatory: string[];
  missingPlanned: string[];
  reasons: string[];
}

/**
 * The only P7 primary metric. Gate pass is deterministic:
 * all mandatory checks pass, no critical safety finding, every planned file exists,
 * and syntax explicitly passed. No LLM judge, no inference from prose.
 */
export function computeGatePass(input: GatePassInput): GatePassResult {
  const mandatory = input.checks.filter((check) => check.mandatory);
  const failedMandatory = mandatory.filter((check) => check.status !== 'pass').map((check) => check.id);
  const missingPlanned = input.plannedFiles.filter((file) => !input.generatedFiles.includes(file));
  const reasons: string[] = [];
  if (mandatory.length === 0) reasons.push('no mandatory checks');
  if (failedMandatory.length > 0) reasons.push(`mandatory checks failed: ${failedMandatory.join(', ')}`);
  if (input.criticalSafety) reasons.push('critical safety regression');
  if (missingPlanned.length > 0) reasons.push(`planned files missing: ${missingPlanned.join(', ')}`);
  if (!input.syntaxPass) reasons.push('syntax did not pass');
  return {
    pass: reasons.length === 0,
    mandatoryChecks: mandatory.length,
    failedMandatory,
    missingPlanned,
    reasons,
  };
}

export function criticalSafetyFromChecks(checks: CheckResult[]): boolean {
  return checks.some(
    (check) =>
      check.status === 'fail' &&
      (check.mandatory || /secret|pii|path|stub|safety/i.test(check.id)),
  );
}

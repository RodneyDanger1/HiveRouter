/**
 * RVS — risk-tiered verification scheduler (P6a A3).
 *
 * Syntax is mandatory for every generated code file, at every risk tier.
 * Tiers add checks; they never remove a base mandatory check. Mandatory
 * checks run even when their estimate exceeds the budget (overBudget=true);
 * only optional checks are skipped.
 */
import {
  AlgorithmRefusal,
  CheckSpec,
  CheckSpecSchema,
  RiskFile,
  RiskTier,
  VerificationCheck,
  VerificationPlan,
  VerificationPlanSchema,
  VerificationRequest,
  VerificationRequestSchema,
  normalizeLanguage,
} from '../../shared/algorithms';

const RISK_RANK: Record<RiskTier, number> = { T0: 3, T1: 2, T2: 1, T3: 0 };

export const DEFAULT_CHECK_SPECS: readonly CheckSpec[] = [
  { checkId: 'path.safety', kind: 'all', languages: [], pathPatterns: [], mandatory: true, estimatedMs: 2, riskRank: 3 },
  { checkId: 'secret.scan', kind: 'all', languages: [], pathPatterns: [], mandatory: true, estimatedMs: 3, riskRank: 3 },
  { checkId: 'plan.coverage', kind: 'all', languages: [], pathPatterns: [], mandatory: true, estimatedMs: 5, riskRank: 2 },
  { checkId: 'stub.scan', kind: 'code', languages: [], pathPatterns: [], mandatory: true, estimatedMs: 4, riskRank: 2 },
  { checkId: 'syntax.python', kind: 'language', languages: ['python'], pathPatterns: [], mandatory: true, estimatedMs: 8, riskRank: 2 },
  { checkId: 'syntax.typescript', kind: 'language', languages: ['typescript'], pathPatterns: [], mandatory: true, estimatedMs: 10, riskRank: 2 },
  { checkId: 'syntax.tsx', kind: 'language', languages: ['tsx'], pathPatterns: [], mandatory: true, estimatedMs: 10, riskRank: 2 },
  { checkId: 'syntax.javascript', kind: 'language', languages: ['javascript'], pathPatterns: [], mandatory: true, estimatedMs: 8, riskRank: 2 },
  { checkId: 'syntax.jsx', kind: 'language', languages: ['jsx'], pathPatterns: [], mandatory: true, estimatedMs: 8, riskRank: 2 },
  { checkId: 'syntax.json', kind: 'language', languages: ['json'], pathPatterns: [], mandatory: true, estimatedMs: 2, riskRank: 2 },
  { checkId: 'syntax.yaml', kind: 'language', languages: ['yaml'], pathPatterns: [], mandatory: true, estimatedMs: 3, riskRank: 2 },
  { checkId: 'syntax.sql', kind: 'language', languages: ['sql'], pathPatterns: [], mandatory: true, estimatedMs: 5, riskRank: 2 },
  { checkId: 'syntax.html', kind: 'language', languages: ['html'], pathPatterns: [], mandatory: true, estimatedMs: 5, riskRank: 2 },
  { checkId: 'markdown.structure', kind: 'docs', languages: [], pathPatterns: [], mandatory: true, estimatedMs: 2, riskRank: 0 },
  { checkId: 'tests.present', kind: 'code', languages: [], pathPatterns: [], mandatory: false, estimatedMs: 2, riskRank: 1 },
  { checkId: 'manifest.integrity', kind: 'all', languages: [], pathPatterns: [], mandatory: false, estimatedMs: 2, riskRank: 1 },
];
const KNOWN_CHECK_IDS = new Set(DEFAULT_CHECK_SPECS.map((spec) => spec.checkId));

const CODE_LANGUAGES = new Set([
  'python',
  'typescript',
  'tsx',
  'javascript',
  'jsx',
  'json',
  'yaml',
  'sql',
  'html',
  'css',
  'powershell',
  'batch',
  'bash',
  'rust',
  'cpp',
  'c',
  'go',
  'java',
  'csharp',
  'ruby',
  'swift',
  'php',
]);

function isCode(file: RiskFile): boolean {
  return CODE_LANGUAGES.has(normalizeLanguage(file.language));
}

function isDocs(file: RiskFile): boolean {
  return normalizeLanguage(file.language) === 'markdown' || normalizeLanguage(file.language) === 'text';
}

function applies(spec: CheckSpec, file: RiskFile): boolean {
  if (spec.kind === 'all') return true;
  if (spec.kind === 'code') return isCode(file);
  if (spec.kind === 'docs') return isDocs(file);
  if (spec.kind === 'language') {
    const language = normalizeLanguage(file.language);
    return spec.languages.some((value) => normalizeLanguage(value) === language);
  }
  if (spec.kind === 'path') {
    return spec.pathPatterns.some((pattern) => new RegExp(pattern, 'i').test(file.path));
  }
  return false;
}

function requiredFor(file: RiskFile, spec: CheckSpec): boolean {
  if (spec.mandatory) return true;
  return file.requiredChecks.includes(spec.checkId);
}

function refusal(code: AlgorithmRefusal['code'], message: string, details: Record<string, unknown> = {}): AlgorithmRefusal {
  return { code, message, details };
}

export function planVerification(raw: unknown): VerificationPlan {
  const request = VerificationRequestSchema.parse(raw) as VerificationRequest;
  const specs = (request.checks.length > 0 ? request.checks : DEFAULT_CHECK_SPECS).map((spec) =>
    CheckSpecSchema.parse(spec),
  );
  const available = request.availableChecks ? new Set(request.availableChecks) : null;
  const byCheck = new Map<string, VerificationCheck>();
  const skipped: VerificationPlan['skipped'] = [];
  const refusals: AlgorithmRefusal[] = [];

  for (const spec of specs) {
    const files = request.files.filter((file) => applies(spec, file)).map((file) => file.path).sort();
    if (files.length === 0) {
      skipped.push({ checkId: spec.checkId, files: [], reason: 'not-applicable' });
      continue;
    }
    const mandatory = files.some((path) => {
      const file = request.files.find((row) => row.path === path);
      return file ? requiredFor(file, spec) : false;
    });
    const riskRank = Math.max(
      spec.riskRank,
      ...request.files.filter((file) => files.includes(file.path)).map((file) => RISK_RANK[file.riskTier]),
    );
    const isAvailable = available === null ? KNOWN_CHECK_IDS.has(spec.checkId) : available.has(spec.checkId);
    byCheck.set(spec.checkId, {
      checkId: spec.checkId,
      files,
      mandatory,
      riskRank,
      estimatedMs: Math.max(spec.estimatedMs, files.length * 2),
      status: isAvailable ? 'planned' : 'unverified',
      reason: isAvailable ? 'scheduled' : 'tool-unavailable',
    });
    if (!isAvailable && mandatory) {
      refusals.push(refusal('E_VERIFY_TOOL_UNAVAILABLE', `Mandatory check ${spec.checkId} is unavailable.`, {
        checkId: spec.checkId,
        files,
      }));
    }
  }

  for (const file of request.files) {
    if (!isCode(file)) continue;
    const language = normalizeLanguage(file.language);
    const checkId = `syntax.${language}`;
    if (byCheck.has(checkId)) continue;
    const isAvailable = available === null ? KNOWN_CHECK_IDS.has(checkId) : available.has(checkId);
    byCheck.set(checkId, {
      checkId,
      files: [file.path],
      mandatory: true,
      riskRank: Math.max(2, RISK_RANK[file.riskTier]),
      estimatedMs: 10,
      status: isAvailable ? 'planned' : 'unverified',
      reason: isAvailable ? 'scheduled' : 'tool-unavailable',
    });
    if (!isAvailable) {
      refusals.push(refusal('E_VERIFY_TOOL_UNAVAILABLE', `Mandatory syntax check for ${file.path} is unavailable.`, {
        checkId,
        file: file.path,
        language,
      }));
    }
  }

  const checks = [...byCheck.values()].sort(
    (a, b) =>
      Number(b.mandatory) - Number(a.mandatory) ||
      b.riskRank - a.riskRank ||
      a.estimatedMs - b.estimatedMs ||
      a.checkId.localeCompare(b.checkId),
  );

  const mandatoryEstimatedMs = checks
    .filter((check) => check.mandatory)
    .reduce((sum, check) => sum + check.estimatedMs, 0);
  const overBudget = request.budgetMs < mandatoryEstimatedMs;
  let spent = 0;
  const selected: VerificationCheck[] = [];
  for (const check of checks) {
    if (check.mandatory) {
      selected.push(check);
      continue;
    }
    if (!overBudget && spent + check.estimatedMs <= request.budgetMs - mandatoryEstimatedMs) {
      selected.push(check);
      spent += check.estimatedMs;
    } else {
      skipped.push({ checkId: check.checkId, files: check.files, reason: 'budget' });
    }
  }

  const totalEstimatedMs = selected.reduce((sum, check) => sum + check.estimatedMs, 0);
  const plan: VerificationPlan = {
    checks: selected,
    skipped,
    mandatoryEstimatedMs,
    totalEstimatedMs,
    overBudget,
    budgetMs: request.budgetMs,
    refusals,
  };
  return VerificationPlanSchema.parse(plan);
}

export { RISK_RANK, KNOWN_CHECK_IDS, isCode, isDocs };

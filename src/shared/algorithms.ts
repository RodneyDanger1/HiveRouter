/**
 * HiveRouter P6a algorithm contracts.
 *
 * This module is the single source of truth for the CCR/CPO/FSN/RVS/CCA/CRA
 * request and response shapes. It contains no network, database, filesystem or
 * provider calls: every parser and constant here is safe to use from a pure
 * unit test. Node's crypto module is used only for deterministic SHA-256
 * seed/cluster helpers.
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';

export const MODEL_IDS = ['deepseek-flash', 'deepseek-v4-pro'] as const;
export const THINKING_MODES = ['enabled', 'disabled'] as const;
export const EFFORTS = ['low', 'high', 'max'] as const;
export const OUTPUT_KINDS = ['plan', 'files', 'review', 'tests', 'text'] as const;
export const VERIFICATION_SUPPORTS = ['runtime', 'syntax', 'static-only', 'unverified'] as const;
export const RISK_TIERS = ['T0', 'T1', 'T2', 'T3'] as const;
export const CHECK_STATUSES = ['pass', 'fail', 'warn', 'unverified', 'skipped'] as const;
export const FINISH_REASONS = [
  'stop',
  'length',
  'content_filter',
  'aborted',
  'insufficient_system_resource',
  'tool_calls',
] as const;
export const REPAIR_ACTIONS = [
  'retry_same',
  'switch_agent',
  'switch_model',
  'escalate_thinking',
  'abort',
] as const;
export const FAILURE_CATEGORIES = [
  'syntax',
  'type',
  'import',
  'missing-file',
  'permission',
  'timeout',
  'rate-limit',
  'budget',
  'auth',
  'secret',
  'placeholder',
  'path',
  'policy',
  'test-assert',
  'verification',
  'runtime',
  'unknown',
] as const;

export const ALGORITHM_REFUSAL_CODES = [
  'E_NO_CAPABLE_AGENT',
  'E_ROUTE_BUDGET_INFEASIBLE',
  'E_CONTEXT_INFEASIBLE',
  'E_POLICY_BLOCKED',
  'E_ALL_CANDIDATES_DISABLED',
  'E_DAG_CYCLE_DETECTED',
  'E_RISK_UNVERIFIABLE',
  'E_MISSING_DEPENDENCY',
  'E_FSN_CLUSTER_LIMIT',
  'E_REPAIR_STALLED',
  'E_REPAIR_BUDGET_EXHAUSTED',
  'E_VERIFY_TOOL_UNAVAILABLE',
  'E_CONFIDENCE_ABSTAIN',
  'E_BUDGET_EXCEEDED',
  'E_BUDGET_UNKNOWN_RESERVATION',
  'E_RETRY_INFEASIBLE',
  'E_KEY_INVALID',
  'E_BALANCE_LOW',
] as const;

export type ModelId = (typeof MODEL_IDS)[number];
export type ThinkingMode = (typeof THINKING_MODES)[number];
export type Effort = (typeof EFFORTS)[number];
export type OutputKind = (typeof OUTPUT_KINDS)[number];
export type VerificationSupport = (typeof VERIFICATION_SUPPORTS)[number];
export type RiskTier = (typeof RISK_TIERS)[number];
export type CheckStatus = (typeof CHECK_STATUSES)[number];
export type FinishReason = (typeof FINISH_REASONS)[number];
export type RepairAction = (typeof REPAIR_ACTIONS)[number];
export type FailureCategory = (typeof FAILURE_CATEGORIES)[number];
export type AlgorithmRefusalCode = (typeof ALGORITHM_REFUSAL_CODES)[number];

export const sha256Hex = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex');

export const shortHash = (value: string, length = 16): string => sha256Hex(value).slice(0, length);

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const roundMicro = (usd: number): number => Math.ceil(usd * 1_000_000) / 1_000_000;

export function normalizeLanguage(language: string): string {
  const value = language.trim().toLowerCase();
  const aliases: Record<string, string> = {
    py: 'python',
    python3: 'python',
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    yml: 'yaml',
    ps1: 'powershell',
    pwsh: 'powershell',
    bat: 'batch',
    cmd: 'batch',
    sh: 'bash',
    shell: 'bash',
    'c++': 'cpp',
    cxx: 'cpp',
    md: 'markdown',
    cs: 'csharp',
  };
  return aliases[value] ?? value;
}

/** Convert a capability path glob to a deterministic workspace-relative matcher. */
export function pathGlobToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/\\/g, '/')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000GLOB_DIRS\u0000')
    .replace(/\*\*/g, '\u0000GLOB_ANY\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.')
    .replace(/\u0000GLOB_DIRS\u0000/g, '(?:.*/)?')
    .replace(/\u0000GLOB_ANY\u0000/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

/** True when the path matches any declared glob; an empty glob list means unrestricted. */
export function matchesAnyPathGlob(filePath: string, globs: string[]): boolean {
  if (globs.length === 0) return true;
  const normalized = filePath.replace(/\\/g, '/');
  return globs.some((glob) => pathGlobToRegExp(glob).test(normalized));
}

/** Workspace-relative path guard used before a path can reach the router. */
export function isSafeRelativePath(value: string): boolean {
  if (!value || value.includes('\u0000')) return false;
  if (value.startsWith('/') || value.startsWith('\\') || /^[A-Za-z]:/.test(value)) return false;
  const parts = value.split(/[\\/]+/);
  return parts.every((part) => part !== '' && part !== '.' && part !== '..' && !part.includes(':'));
}

// ---------------------------------------------------------------------------
// CCR contracts
// ---------------------------------------------------------------------------

export const FileTaskSchema = z
  .object({
    id: z.string().min(1),
    path: z.string().min(1),
    language: z.string().min(1),
    duty: z.string().min(1),
    deps: z.array(z.string()).default([]),
    required: z.boolean().default(true),
    riskHints: z.array(z.string()).default([]),
    requiredChecks: z.array(z.string()).default([]),
    estimatedBytes: z.number().int().nonnegative().default(4096),
    engineHint: z.string().min(1).optional(),
  })
  .strict();
export type FileTask = z.infer<typeof FileTaskSchema>;

export const AgentCapabilitySchema = z
  .object({
    agentId: z.string().min(1),
    outputKinds: z.array(z.enum(OUTPUT_KINDS)).min(1),
    canWrite: z.boolean(),
    canReview: z.boolean(),
    canTest: z.boolean(),
    languages: z.array(z.string()).default([]),
    pathGlobs: z.array(z.string()).default([]),
    verificationSupport: z.enum(VERIFICATION_SUPPORTS),
    fallbackFor: z.array(z.string()).default([]),
    maxOutputTokens: z.number().int().positive(),
    staticPrior: z.number().min(0).max(1),
    priorVersion: z.string().min(1),
    promptVersion: z.string().min(1),
    schemaId: z.string().min(1),
    enabled: z.boolean().default(true),
  })
  .strict();
export type AgentCapability = z.infer<typeof AgentCapabilitySchema>;

export const ModelProfileSchema = z
  .object({
    model: z.enum(MODEL_IDS),
    thinking: z.enum(THINKING_MODES),
    effort: z.enum(EFFORTS).optional(),
    inputUsdPerMTok: z.number().nonnegative(),
    outputUsdPerMTok: z.number().nonnegative(),
    contextTokens: z.number().int().positive(),
    maxOutputTokens: z.number().int().positive(),
    supportsJson: z.boolean(),
    latencyMs: z.number().int().positive(),
    qualityDelta: z.number().min(-1).max(1).default(0),
  })
  .strict();
export type ModelProfile = z.infer<typeof ModelProfileSchema>;

export const RouteWeightsSchema = z
  .object({
    wC: z.number().min(0),
    wL: z.number().min(0),
    wR: z.number().min(0),
    qualityWeight: z.number().min(0),
    criticalPathFactor: z.number().min(0),
    costNormUsd: z.number().positive(),
    latencyNormMs: z.number().positive(),
  })
  .strict();
export type RouteWeights = z.infer<typeof RouteWeightsSchema>;

/** Static routing policy constants from PLAN-v3 §6.1.1. */
export const ROUTE_WEIGHT_PRESETS = {
  fast: { wC: 0.55, wL: 0.25, wR: 0.35, qualityWeight: 1, criticalPathFactor: 0.15, costNormUsd: 0.05, latencyNormMs: 120000 },
  balanced: { wC: 0.3, wL: 0.1, wR: 0.45, qualityWeight: 1, criticalPathFactor: 0.15, costNormUsd: 0.05, latencyNormMs: 120000 },
  deep: { wC: 0.1, wL: 0.02, wR: 0.55, qualityWeight: 1, criticalPathFactor: 0.15, costNormUsd: 0.05, latencyNormMs: 120000 },
} as const satisfies Record<'fast' | 'balanced' | 'deep', RouteWeights>;

export const RoutePresetSchema = z.enum(['fast', 'balanced', 'deep']);

export const RoutePolicySchema = z
  .object({
    policyVersion: z.string().min(1),
    routePolicyId: z.string().min(1),
    preset: RoutePresetSchema,
    budgetUsd: z.number().nonnegative(),
    reserveRatio: z.number().min(0).max(1).default(0.2),
    maxFiles: z.number().int().positive().max(24).default(24),
    weights: RouteWeightsSchema,
    riskThreshold: z.number().min(0).max(1).default(0.5),
    blockedRiskHints: z.array(z.string()).default([]),
    allowThinkingDowngrade: z.boolean().default(true),
    requireJsonForStructured: z.boolean().default(true),
  })
  .strict();
export type RoutePolicy = z.infer<typeof RoutePolicySchema>;

export const RouteRequestSchema = z
  .object({
    runId: z.string().min(1).optional(),
    tasks: z.array(FileTaskSchema).min(1).max(24),
    capabilities: z.array(AgentCapabilitySchema).min(1),
    policy: RoutePolicySchema,
    modelProfiles: z.array(ModelProfileSchema).default([]),
  })
  .strict();
export type RouteRequest = z.infer<typeof RouteRequestSchema>;

export const CandidateOptionSchema = z
  .object({
    agentId: z.string(),
    model: z.enum(MODEL_IDS),
    thinking: z.enum(THINKING_MODES),
    effort: z.enum(EFFORTS).optional(),
    quality: z.number().min(0).max(1),
    qualitySource: z.literal('prior'),
    sampleSize: z.literal(0),
    costUsd: z.number().nonnegative(),
    costMicroUsd: z.number().int().nonnegative(),
    latencyMs: z.number().int().positive(),
    contextFit: z.number().min(0).max(1),
    risk: z.number().min(0).max(1),
    score: z.number(),
    criticalPath: z.number().min(0).max(1),
    rankKey: z.string(),
  })
  .strict();
export type CandidateOption = z.infer<typeof CandidateOptionSchema>;

export const AlgorithmRefusalSchema = z
  .object({
    code: z.enum(ALGORITHM_REFUSAL_CODES),
    taskId: z.string().optional(),
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type AlgorithmRefusal = z.infer<typeof AlgorithmRefusalSchema>;

export const TaskRouteSchema = z
  .object({
    taskId: z.string(),
    agentId: z.string(),
    model: z.enum(MODEL_IDS),
    thinking: z.enum(THINKING_MODES),
    effort: z.enum(EFFORTS).optional(),
    quality: z.number(),
    qualitySource: z.literal('prior'),
    sampleSize: z.literal(0),
    score: z.number(),
    costUsd: z.number(),
    latencyMs: z.number(),
    rankKey: z.string(),
    criticalPath: z.number(),
    /** All feasible options considered for this task, not only the chosen one. */
    candidates: z.array(CandidateOptionSchema).default([]),
  })
  .strict();
export type TaskRoute = z.infer<typeof TaskRouteSchema>;

export const RouteResultSchema = z
  .object({
    ok: z.boolean(),
    seed: z.string(),
    routes: z.array(TaskRouteSchema),
    skippedTasks: z.array(z.string()),
    refusals: z.array(AlgorithmRefusalSchema),
    allocatedCostUsd: z.number().nonnegative(),
    reserveUsd: z.number().nonnegative(),
    allocatableUsd: z.number().nonnegative(),
    decisionIds: z.array(z.string()),
    criticalPath: z.array(z.string()),
    constraints: z.record(z.string(), z.unknown()),
  })
  .strict();
export type RouteResult = z.infer<typeof RouteResultSchema>;

/** Conservative static model profiles; pricing is a conservative peak-miss default. */
export const DEFAULT_MODEL_PROFILES: readonly ModelProfile[] = [
  {
    model: 'deepseek-flash',
    thinking: 'disabled',
    inputUsdPerMTok: 0.3,
    outputUsdPerMTok: 1.2,
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    supportsJson: true,
    latencyMs: 20_000,
    qualityDelta: 0,
  },
  {
    model: 'deepseek-flash',
    thinking: 'enabled',
    effort: 'high',
    inputUsdPerMTok: 0.3,
    outputUsdPerMTok: 1.2,
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    supportsJson: true,
    latencyMs: 45_000,
    qualityDelta: 0.03,
  },
  {
    model: 'deepseek-v4-pro',
    thinking: 'enabled',
    effort: 'high',
    inputUsdPerMTok: 1.32,
    outputUsdPerMTok: 3.96,
    contextTokens: 1_048_576,
    maxOutputTokens: 393_216,
    supportsJson: true,
    latencyMs: 70_000,
    qualityDelta: 0.05,
  },
];

export const RISK_HINT_WEIGHTS: Readonly<Record<string, number>> = {
  auth: 0.4,
  secrets: 0.5,
  db: 0.3,
  database: 0.3,
  shell: 0.35,
  filesystem: 0.2,
  network: 0.2,
  'public-api': 0.25,
  ui: 0.1,
  docs: 0,
};

export const RISK_PATH_WEIGHTS: ReadonlyArray<readonly [RegExp, number]> = [
  [/(^|\/)(auth|session|login|password|secret|token)(\/|\.|$)/i, 0.45],
  [/(^|\/)(migrations?|schema|db|database)(\/|\.|$)/i, 0.25],
  [/(^|\/)(Dockerfile|docker-compose|\.github\/workflows)/i, 0.2],
  [/\.(ps1|cmd|bat|sh)$/i, 0.3],
];

// ---------------------------------------------------------------------------
// CPO contracts
// ---------------------------------------------------------------------------

export const ContextItemSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['system', 'brief', 'plan', 'interface', 'dependency', 'review', 'test', 'outline']),
    path: z.string().optional(),
    text: z.string(),
    tokens: z.number().int().nonnegative().optional(),
    mandatory: z.boolean().default(false),
    cachePrefix: z.boolean().default(false),
    secret: z.boolean().default(false),
    importance: z.number().nonnegative().optional(),
    criticality: z.number().min(0).max(1).default(0),
  })
  .strict();
export type ContextItem = z.infer<typeof ContextItemSchema>;

export const ContextRequestSchema = z
  .object({
    taskId: z.string().min(1),
    maxTokens: z.number().int().positive(),
    prefix: z
      .object({
        system: z.string(),
        briefDigest: z.string(),
        planSummary: z.string(),
      })
      .strict(),
    mandatory: z.array(ContextItemSchema).default([]),
    optional: z.array(ContextItemSchema).default([]),
    graph: z
      .object({
        nodes: z.array(z.string()),
        edges: z.array(z.tuple([z.string(), z.string()])),
      })
      .strict()
      .optional(),
    expectedPrefixHash: z.string().optional(),
  })
  .strict();
export type ContextRequest = z.infer<typeof ContextRequestSchema>;

export const ContextPackSchema = z
  .object({
    ok: z.boolean(),
    taskId: z.string(),
    items: z.array(ContextItemSchema),
    excluded: z.array(
      z.object({
        id: z.string(),
        reason: z.enum(['over-budget', 'low-importance', 'summarized', 'duplicate', 'secret', 'missing']),
      }),
    ),
    estimatedTokens: z.number().int().nonnegative(),
    mandatoryTokens: z.number().int().nonnegative(),
    prefixHash: z.string(),
    cachePrefixStable: z.boolean(),
    pageRank: z.object({ converged: z.boolean(), iterations: z.number().int().nonnegative() }),
    degraded: z.boolean(),
    refusal: AlgorithmRefusalSchema.optional(),
  })
  .strict();
export type ContextPack = z.infer<typeof ContextPackSchema>;

// ---------------------------------------------------------------------------
// FSN contracts
// ---------------------------------------------------------------------------

export const FailureInputSchema = z
  .object({
    checkId: z.string().min(1),
    taskId: z.string().min(1),
    file: z.string().min(1),
    line: z.number().int().positive().optional(),
    message: z.string(),
    stderr: z.string().default(''),
    exitCode: z.number().int().optional(),
    language: z.string().min(1),
    attempt: z.number().int().positive().default(1),
  })
  .strict();
export type FailureInput = z.infer<typeof FailureInputSchema>;

export const FailureClusterSchema = z
  .object({
    clusterId: z.string(),
    category: z.enum(FAILURE_CATEGORIES),
    language: z.string(),
    representative: z.string(),
    representativeText: z.string().optional(),
    signatures: z.array(z.string()),
    occurrences: z.number().int().nonnegative(),
    blastRadius: z.number().int().nonnegative(),
    repairFailures: z.number().int().nonnegative().default(0),
    suppressed: z.boolean().default(false),
  })
  .strict();
export type FailureCluster = z.infer<typeof FailureClusterSchema>;

export const FailureTriageRequestSchema = z
  .object({
    failures: z.array(FailureInputSchema).min(1),
    existing: z.array(FailureClusterSchema).default([]),
    graph: z
      .object({
        nodes: z.array(z.string()),
        edges: z.array(z.tuple([z.string(), z.string()])),
      })
      .strict(),
    maxClusters: z.number().int().positive().max(200).default(200),
  })
  .strict();
export type FailureTriageRequest = z.infer<typeof FailureTriageRequestSchema>;

export const FailureTriageResultSchema = z
  .object({
    clusters: z.array(FailureClusterSchema),
    occurrences: z.array(
      z.object({
        signature: z.string(),
        clusterId: z.string(),
        category: z.enum(FAILURE_CATEGORIES),
        targets: z.array(z.string()).max(3),
        priority: z.number(),
      }),
    ),
    refusals: z.array(AlgorithmRefusalSchema),
    suppressedSignatures: z.array(z.string()),
  })
  .strict();
export type FailureTriageResult = z.infer<typeof FailureTriageResultSchema>;

// ---------------------------------------------------------------------------
// RVS contracts
// ---------------------------------------------------------------------------

export const RiskFileSchema = z
  .object({
    path: z.string().min(1),
    language: z.string().min(1),
    riskTier: z.enum(RISK_TIERS),
    requiredChecks: z.array(z.string()).default([]),
  })
  .strict();
export type RiskFile = z.infer<typeof RiskFileSchema>;

export const CheckSpecSchema = z
  .object({
    checkId: z.string().min(1),
    kind: z.enum(['all', 'code', 'docs', 'language', 'path']),
    languages: z.array(z.string()).default([]),
    pathPatterns: z.array(z.string()).default([]),
    mandatory: z.boolean().default(false),
    estimatedMs: z.number().int().positive(),
    riskRank: z.number().int().min(0).max(9),
  })
  .strict();
export type CheckSpec = z.infer<typeof CheckSpecSchema>;

export const VerificationRequestSchema = z
  .object({
    files: z.array(RiskFileSchema).min(1),
    checks: z.array(CheckSpecSchema).default([]),
    availableChecks: z.array(z.string()).optional(),
    budgetMs: z.number().int().nonnegative(),
  })
  .strict();
export type VerificationRequest = z.infer<typeof VerificationRequestSchema>;

export const VerificationCheckSchema = z
  .object({
    checkId: z.string(),
    files: z.array(z.string()),
    mandatory: z.boolean(),
    riskRank: z.number().int(),
    estimatedMs: z.number().int(),
    status: z.enum(['planned', 'unverified']),
    reason: z.string(),
  })
  .strict();
export type VerificationCheck = z.infer<typeof VerificationCheckSchema>;

export const VerificationPlanSchema = z
  .object({
    checks: z.array(VerificationCheckSchema),
    skipped: z.array(
      z.object({
        checkId: z.string(),
        files: z.array(z.string()),
        reason: z.enum(['budget', 'not-applicable', 'tool-missing']),
      }),
    ),
    mandatoryEstimatedMs: z.number().int().nonnegative(),
    totalEstimatedMs: z.number().int().nonnegative(),
    overBudget: z.boolean(),
    budgetMs: z.number().int().nonnegative(),
    refusals: z.array(AlgorithmRefusalSchema),
  })
  .strict();
export type VerificationPlan = z.infer<typeof VerificationPlanSchema>;

// ---------------------------------------------------------------------------
// CCA contracts
// ---------------------------------------------------------------------------

export const ConfidenceInputSchema = z
  .object({
    taskId: z.string().min(1),
    verification: z.number().min(0).max(1).optional(),
    review: z.number().min(0).max(1).optional(),
    schema: z.number().min(0).max(1).optional(),
    finish: z.number().min(0).max(1).optional(),
    routePrior: z.number().min(0).max(1).optional(),
    mandatoryFailed: z.boolean().default(false),
    mandatoryUnverified: z.boolean().default(false),
    calibrationSamples: z.number().int().nonnegative().default(0),
  })
  .strict();
export type ConfidenceInput = z.infer<typeof ConfidenceInputSchema>;

export const ConfidenceResultSchema = z
  .object({
    taskId: z.string(),
    raw: z.number().min(0).max(1),
    calibrated: z.number().min(0).max(1),
    components: z.object({
      verification: z.number().min(0).max(1),
      review: z.number().min(0).max(1),
      schema: z.number().min(0).max(1),
      finish: z.number().min(0).max(1),
      routePrior: z.number().min(0).max(1),
    }),
    calibrationSource: z.enum(['identity', 'isotonic']),
    calibrationVersion: z.string(),
    decision: z.enum(['accept', 'retry', 'needs_review', 'reject']),
    threshold: z.number(),
    provisional: z.boolean(),
    abstained: z.boolean(),
    refusal: AlgorithmRefusalSchema.optional(),
  })
  .strict();
export type ConfidenceResult = z.infer<typeof ConfidenceResultSchema>;

export const CONFIDENCE_WEIGHTS = {
  verification: 0.45,
  review: 0.25,
  schema: 0.15,
  finish: 0.1,
  routePrior: 0.05,
} as const;

// ---------------------------------------------------------------------------
// CRA contracts
// ---------------------------------------------------------------------------

export const RetryCandidateSchema = z
  .object({
    agentId: z.string().min(1),
    model: z.enum(MODEL_IDS),
    thinking: z.enum(THINKING_MODES),
    effort: z.enum(EFFORTS).optional(),
    costUsd: z.number().nonnegative(),
    expectedSeconds: z.number().nonnegative(),
    quality: z.number().min(0).max(1),
    maxOutputTokens: z.number().int().positive(),
    capabilityFiltered: z.boolean().default(true),
  })
  .strict();
export type RetryCandidate = z.infer<typeof RetryCandidateSchema>;

export const RetryRequestSchema = z
  .object({
    taskId: z.string().min(1),
    attempt: z.number().int().positive(),
    maxAttempts: z.number().int().positive().default(3),
    repairsDone: z.number().int().nonnegative().default(0),
    maxRepairs: z.number().int().positive().default(2),
    failureCategory: z.enum(FAILURE_CATEGORIES),
    finishReason: z.enum(FINISH_REASONS),
    currentAgentId: z.string().min(1),
    currentModel: z.enum(MODEL_IDS),
    currentThinking: z.enum(THINKING_MODES),
    currentCostUsd: z.number().nonnegative(),
    currentExpectedSeconds: z.number().nonnegative(),
    budget: z
      .object({
        spentUsd: z.number().nonnegative().nullable(),
        remainingUsd: z.number().nonnegative().nullable(),
        reserveUsd: z.number().nonnegative().nullable(),
      })
      .strict()
      .nullable(),
    candidates: z.array(RetryCandidateSchema).default([]),
    riskTier: z.enum(RISK_TIERS).default('T2'),
    lambdaUsdPerSec: z.number().nonnegative().default(0.001),
    attemptEvidence: z.number().min(0).max(1).default(0),
  })
  .strict();
export type RetryRequest = z.infer<typeof RetryRequestSchema>;

export const RetryDecisionSchema = z
  .object({
    taskId: z.string(),
    attempt: z.number().int().positive(),
    action: z.enum(REPAIR_ACTIONS),
    candidate: RetryCandidateSchema.optional(),
    expectedCostUsd: z.number().nonnegative(),
    expectedValue: z.number(),
    reason: z.string(),
    refusalCode: z.enum(ALGORITHM_REFUSAL_CODES).optional(),
    backoffMs: z.number().int().nonnegative().optional(),
  })
  .strict();
export type RetryDecision = z.infer<typeof RetryDecisionSchema>;

export const STATIC_PSUCCESS_PRIORS: Readonly<Record<string, number>> = {
  'syntax:retry_same': 0.55,
  'type:retry_same': 0.5,
  'import:retry_same': 0.6,
  'missing-file:retry_same': 0.55,
  'timeout:retry_same': 0.45,
  'rate-limit:retry_same': 0.7,
  'placeholder:retry_same': 0.6,
  'test-assert:retry_same': 0.35,
  'runtime:retry_same': 0.3,
  'verification:retry_same': 0.25,
  'unknown:retry_same': 0.3,
  'verification:switch_agent': 0.45,
  'syntax:switch_agent': 0.4,
  'runtime:switch_agent': 0.35,
  'syntax:switch_model': 0.45,
  'length:switch_model': 0.6,
  'runtime:escalate_thinking': 0.4,
  'syntax:escalate_thinking': 0.4,
};

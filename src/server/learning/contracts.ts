import { z } from 'zod';
import { AGENT_IDS } from '../../shared/types.js';

export const LEARNING_CONSENT_SCOPES = [
  'trace_retention',
  'trace_to_provider_reflection',
  'case_to_provider_eval',
  'dsh_key',
] as const;
export type LearningConsentScope = (typeof LEARNING_CONSENT_SCOPES)[number];
export const ConsentScopeSchema = z.enum(LEARNING_CONSENT_SCOPES);

export const LearningProvenanceSchema = z.enum(['mock', 'live', 'human', 'synthetic']);
export type LearningProvenance = z.infer<typeof LearningProvenanceSchema>;

export const CandidateKindSchema = z.enum(['prompt', 'context', 'threshold']);
export type CandidateKind = z.infer<typeof CandidateKindSchema>;

export const THRESHOLD_BOUNDS = {
  maxRepairRounds: { min: 1, max: 2 },
  contextTokenBudget: { min: 100_000, max: 500_000 },
  retryBackoffMs: { min: 500, max: 30_000 },
  costWarnPercent: { min: 10, max: 100 },
} as const;
export type ThresholdKey = keyof typeof THRESHOLD_BOUNDS;
export const ThresholdKeySchema = z.enum(
  Object.keys(THRESHOLD_BOUNDS) as [ThresholdKey, ...ThresholdKey[]],
);

export const SAFETY_POLICY_VERSION = 'learning-safety-v1';
export const SAFETY_POLICY = {
  version: SAFETY_POLICY_VERSION,
  immutableChecks: [
    'mandatory_checks',
    'secret_scan',
    'pii_scan',
    'stub_scan',
    'path_safety',
    'gate_precedence',
  ],
  thresholdAllowlist: THRESHOLD_BOUNDS,
} as const;

export const PromptPayloadSchema = z.object({
  prompt: z.string().min(1).max(20_000),
}).strict();

export const ContextPayloadSchema = z.object({
  template: z.string().min(1).max(20_000),
}).strict();

export const ThresholdPayloadSchema = z.object({
  // Unknown keys are accepted here and rejected by lintCandidate with E_LEARNING_UNSAFE_THRESHOLD.
  key: z.string().min(1).max(64),
  value: z.number().finite(),
}).strict();

export const CandidateDraftSchema = z.object({
  kind: CandidateKindSchema,
  targetAgentId: z.enum(AGENT_IDS),
  parentVersionId: z.string().min(1),
  baselineVersionId: z.string().min(1),
  candidateFamilyId: z.string().min(1).max(120),
  payload: z.union([PromptPayloadSchema, ContextPayloadSchema, ThresholdPayloadSchema]),
  hypothesis: z.string().min(10).max(500),
  targetSignature: z.string().min(1).max(128).optional(),
  createdBy: z.enum(['human', 'metacognitive']),
}).superRefine((draft, ctx) => {
  if (draft.kind === 'prompt' && !('prompt' in draft.payload)) {
    ctx.addIssue({ code: 'custom', message: 'prompt candidate requires payload.prompt' });
  }
  if (draft.kind === 'context' && !('template' in draft.payload)) {
    ctx.addIssue({ code: 'custom', message: 'context candidate requires payload.template' });
  }
  if (draft.kind === 'threshold' && !('key' in draft.payload)) {
    ctx.addIssue({ code: 'custom', message: 'threshold candidate requires payload.key/value' });
  }
});
export type CandidateDraft = z.infer<typeof CandidateDraftSchema>;

export const TraceInputSchema = z.object({
  runId: z.string().min(1),
  stepId: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
  phase: z.string().min(1).optional(),
  promptVersion: z.string().min(1).optional(),
  contextPackId: z.string().min(1).optional(),
  policyVersionId: z.string().min(1).optional(),
  model: z.enum(['deepseek-flash', 'deepseek-v4-pro']),
  thinking: z.enum(['enabled', 'disabled']),
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  cacheHitTokens: z.number().int().nonnegative().optional(),
  cacheMissTokens: z.number().int().nonnegative().optional(),
  reasoningTokens: z.number().int().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  outcome: z.enum(['success', 'warning', 'failure', 'cancelled']),
  failureSignature: z.string().min(1).max(128).nullable().optional(),
  errorMessage: z.string().max(8192).optional(),
  verifier: z.unknown().optional(),
  repairRound: z.number().int().nonnegative().optional(),
  provenance: LearningProvenanceSchema,
  redactionStatus: z.enum(['clean', 'redacted', 'blocked']).optional(),
  inputPreview: z.string().max(4096).optional(),
  outputPreview: z.string().max(4096).optional(),
  userVerdict: z.enum(['accepted', 'edited', 'rejected']).nullable().optional(),
  editDistance: z.number().int().nonnegative().nullable().optional(),
});
export type TraceInput = z.infer<typeof TraceInputSchema>;

export const SealedCaseSchema = z.object({
  caseId: z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/),
  source: z.string().min(1).max(500),
  license: z.string().min(1).max(100),
  consentId: z.string().min(1).max(120).nullable(),
  capturedAt: z.string().min(1),
  split: z.enum(['dev', 'holdout']),
  brief: z.string().min(1).max(20_000),
  fixture: z.unknown(),
  expected: z.unknown(),
});
export type SealedCase = z.infer<typeof SealedCaseSchema>;

export const PairedOutcomeSchema = z.object({
  caseId: z.string().min(1),
  baselinePass: z.boolean(),
  candidatePass: z.boolean(),
  baselineCostUsd: z.number().nonnegative().nullable().optional(),
  candidateCostUsd: z.number().nonnegative().nullable().optional(),
  candidateCriticalSafety: z.boolean().optional(),
});
export type PairedOutcome = z.infer<typeof PairedOutcomeSchema>;

export const DEFAULT_SEED = 0x5eed1e42;
export const BOOTSTRAP_ITERATIONS = 10_000;
export const HOLDOUT_TARGET = 50;
export const DEV_TARGET = 15;
export const BLOCK_CASES = 65;
export const MIN_SEALED_BLOCKS = 6;

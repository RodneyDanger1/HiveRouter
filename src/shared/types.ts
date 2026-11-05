export const RUN_STATUSES = [
  'queued',
  'running',
  'paused',
  'needs_review',
  'completed',
  'completed_with_warnings',
  'failed',
  'cancelled',
  'budget_exceeded',
  'interrupted',
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set([
  'completed',
  'completed_with_warnings',
  'failed',
  'cancelled',
  'budget_exceeded',
  'interrupted',
]);

export const RUN_PHASES = [
  'intake',
  'planning',
  'routing',
  'generating',
  'cleaning',
  'hardening',
  'testing',
  'verifying',
  'repairing',
  'finalizing',
  'done',
] as const;
export type RunPhase = (typeof RUN_PHASES)[number];

export const PRESETS = ['full-build', 'blueprint', 'ui-build', 'docs', 'revise', 'audit', 'adhoc'] as const;
export type Preset = (typeof PRESETS)[number];

export const AGENT_IDS = [
  'router',
  'architect',
  'metacognitive',
  'epic',
  'cartographer',
  'structural-engine',
  'python-engine',
  'polyglot-engine',
  'js-engine',
  'ts-engine',
  'baremetal-engine',
  'algorithm-engine',
  'html-engine',
  'react-engine',
  'tailwind-engine',
  'threejs-engine',
  'nds-engine',
  'powershell-core',
  'powershell-api',
  'powershell-diagnostics',
  'cmd-engine',
  'bash-engine',
  'schema-engine',
  'sql-engine',
  'yaml-engine',
  'symbolic-logic-engine',
  'markdown-engine',
  'cleaner',
  'sentinel',
  'watchman',
  'gatekeeper',
  'gitops-engine',
  'sandbox-engine',
  'package-engine',
  'live-monitor-engine',
  'db-janitor-engine',
  'harvester-engine',
] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export type OutputKind = 'plan' | 'files' | 'review' | 'tests' | 'text';
export const MODEL_IDS = ['deepseek-flash', 'deepseek-v4-pro'] as const;
export type ModelId = (typeof MODEL_IDS)[number];
export const THINKING_MODES = ['enabled', 'disabled'] as const;
export type ThinkingMode = (typeof THINKING_MODES)[number];
export const EFFORTS = ['low', 'high', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];
export type VerificationSupport = 'runtime' | 'syntax' | 'static-only' | 'unverified';
export type Provenance = 'mock' | 'live' | 'human' | 'synthetic';

export interface AgentDefinition {
  id: AgentId;
  name: string;
  group: string;
  outputKind: OutputKind;
  canWrite: boolean;
  canReview: boolean;
  canTest: boolean;
  languages: string[];
  pathGlobs: string[];
  verificationSupport: VerificationSupport;
  fallbackFor: string[];
  maxOutputTokens: number;
  staticPrior: number;
  priorVersion: string;
  promptVersion: string;
  schemaId: string;
  role: string;
  objective: string;
  rules: string[];
  prompt: string;
}

export interface AgentCapability {
  agentId: string;
  outputKinds: OutputKind[];
  canWrite: boolean;
  canReview: boolean;
  canTest: boolean;
  languages: string[];
  pathGlobs: string[];
  verificationSupport: VerificationSupport;
  fallbackFor: string[];
  maxOutputTokens: number;
  staticPrior: number;
  priorVersion: string;
  promptVersion: string;
  schemaId: string;
  enabled: boolean;
}

export interface FileTask {
  id: string;
  path: string;
  language: string;
  duty: string;
  deps: string[];
  required: boolean;
  riskHints: string[];
  requiredChecks: string[];
  estimatedBytes: number;
  engineHint?: string;
}

export interface PlanFile {
  path: string;
  engine: string;
  language: string;
  duty: string;
  deps: string[];
  interfaces: string[];
}

export interface ProjectPlan {
  projectName: string;
  coreParadigm: string;
  storageTarget: string;
  files: PlanFile[];
  interfaces: Array<{ name: string; input: string; output: string }>;
  executionGraph: Array<{ step: number; file: string; deps: string[] }>;
  risks: string[];
}

export interface RouterPlan {
  summary: string;
  useEpic: boolean;
  preset: Preset;
  suggestedAgents: AgentId[];
  steps: Array<{ agent: AgentId; objective: string }>;
  risks: string[];
}

export interface GeneratedFile {
  path: string;
  language: string;
  content: string;
  summary: string;
  execution: string;
  complete: boolean;
  agentId: AgentId;
  sha256: string;
  bytes: number;
}

export interface ReviewResult {
  verdict: 'pass' | 'changes_required';
  summary: string;
  findings: Array<{
    severity: 'info' | 'warn' | 'critical';
    file: string;
    line?: number;
    issue: string;
    fix: string;
  }>;
  files: Array<{ path: string; content: string }>;
  execution?: string;
}

export interface TestOutput {
  summary: string;
  testCommand: string;
  files: Array<{ path: string; language: string; content: string }>;
}

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'unverified' | 'skipped';

export interface CheckResult {
  id: string;
  /** Unique persisted row identity; the verifier check id repeats across passes. */
  rowId?: string;
  status: CheckStatus;
  detail: string;
  file?: string;
  line?: number;
  code?: string;
  durationMs?: number;
  mandatory: boolean;
}

export interface GateDecision {
  status: 'pass' | 'pass_with_warnings' | 'fail';
  reasons: string[];
  actions: Array<'stop' | 'repair' | 'finalize' | 'write_manifest'>;
  repairEligible: boolean;
  signature: string;
}

export interface UsageRecord {
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  reasoningTokens: number;
  costUsd: number;
  source: 'provider' | 'estimated' | 'unknown';
  model: string;
  systemFingerprint?: string;
}

export interface RunSnapshot {
  id: string;
  runId: string;
  createdAt: string;
  model: ModelId;
  thinking: ThinkingMode;
  effort?: Effort;
  preset: Preset;
  limits: Record<string, unknown>;
  pricing: Record<string, unknown>;
  engineMap: Record<string, string>;
  promptVersions: Array<{ agentId: string; version: string; hash: string; text: string }>;
  policyVersion: { id: string; version: string; hash: string; json: string };
  capabilities: AgentCapability[];
  hash: string;
}

export interface RunRecord {
  id: string;
  parentRunId: string | null;
  brief: string;
  preset: Preset;
  status: RunStatus;
  phase: RunPhase;
  model: ModelId;
  thinking: ThinkingMode;
  effort: Effort | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  costUsd: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  workspacePath: string;
  summary: string | null;
  snapshotHash: string | null;
  policyVersionId: string | null;
  traceComplete: boolean;
  runKind: 'user' | 'revision' | 'audit' | 'adhoc' | 'resume' | 'eval';
}

export interface StepRecord {
  id: string;
  runId: string;
  seq: number;
  phase: RunPhase;
  agentId: string | null;
  status: 'started' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';
  startedAt: string;
  finishedAt: string | null;
  inputSummary: string | null;
  outputSummary: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
}

export interface ArtifactRecord {
  id: string;
  runId: string;
  path: string;
  kind: 'code' | 'test' | 'doc' | 'config' | 'report' | 'manifest';
  language: string;
  sha256: string;
  bytes: number;
  agentId: string | null;
  revisedFrom: string | null;
  createdAt: string;
  redactionStatus: 'clean' | 'redacted' | 'blocked';
  redactorVersion: string;
  /** `staged` artifacts are retained evidence from a failed/unpublished run. */
  status: 'accepted' | 'staged';
  mime: string | null;
}

export interface RunEvent {
  seq: number;
  runId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ApiMeta {
  version: string;
  schemaVersion: number;
  requestId: string;
  durationMs?: number;
  dryRun?: boolean;
  idempotencyKey?: string;
  replayed?: boolean;
  provenance?: Provenance;
}

export type ApiEnvelope<T> =
  | { schema: 'hive.api.v1'; ok: true; data: T; warnings: Array<{ code: string; message: string }>; meta: ApiMeta }
  | { schema: 'hive.api.v1'; ok: false; error: { code: string; message: string; hint?: string; retryable: boolean; details?: unknown }; meta: ApiMeta };

export interface RunStats {
  agentCount: number;
  runCount: number;
  /** Honest totals: null when at least one usage row is unknown. */
  totalPromptTokens: number | null;
  totalCompletionTokens: number | null;
  totalCostUsd: number | null;
  /** Measured portions remain visible even when totals are partial. */
  measuredPromptTokens: number;
  measuredCompletionTokens: number;
  measuredCostUsd: number;
  chatCostUsd: number | null;
  unknownUsageRows: number;
  partial: boolean;
}

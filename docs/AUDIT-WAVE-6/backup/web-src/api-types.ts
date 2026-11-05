import type {
  AgentDefinition,
  ArtifactRecord,
  CheckResult,
  RunRecord,
  StepRecord,
} from '@shared/types';
import type { PromptAnalysis } from '@shared/prompt-analysis';

export interface PromptAnalysisResponse {
  schema: string;
  analysis: PromptAnalysis;
  repairAttempted: boolean;
  model: string;
  promptChars: number;
}

export interface MetaResponse {
  phase: string;
  features: { routing: boolean; learning: boolean };
  version: string;
}

export interface HealthResponse {
  status?: string;
  version?: string;
  model?: string;
  db?: string;
  workspace?: string;
  uptimeSec?: number;
  key?: { configured?: boolean; source?: string };
  [key: string]: unknown;
}

export interface BalanceInfo {
  currency?: string | null;
  total?: number | string | null;
  granted?: number | string | null;
  toppedUp?: number | string | null;
}

export interface KeyStatusResponse {
  configured: boolean;
  source?: string | null;
  fingerprint?: string | null;
  balance?: BalanceInfo | null;
  checkedAt?: string | null;
  [key: string]: unknown;
}

export interface AgentEvidence {
  badge: string;
  provenance?: string;
  runId?: string | null;
  createdAt?: string;
}

export interface AgentView extends AgentDefinition {
  enabled?: boolean;
  badges?: string[];
  evidence?: AgentEvidence[];
}

export interface RunSnapshotView {
  run: RunRecord;
  steps: StepRecord[];
  checks: CheckResult[];
  artifacts: ArtifactRecord[];
  lastEventId?: number;
  truncated?: boolean;
  [key: string]: unknown;
}

export interface RunListResponse {
  runs: RunRecord[];
  total?: number;
}

export interface StartRunInput {
  brief: string;
  preset: string;
  model?: string;
  thinking?: string;
  effort?: string;
  maxCostUsd?: number;
  sourceRunId?: string;
  options?: Record<string, unknown>;
}

export interface StartRunResponse {
  runId: string;
}

export interface AgentRunInput {
  input: string;
  mode: 'mock' | 'live';
  maxCostUsd?: number;
  targetPath?: string;
  options?: Record<string, unknown>;
}

export interface RunStreamEvent {
  type: string;
  data: unknown;
  receivedAt: string;
}

export interface RouteCandidateView {
  agentId?: string;
  model?: string;
  thinking?: string;
  effort?: string;
  quality?: number | null;
  qualitySource?: string;
  sampleSize?: number | null;
  costUsd?: number | null;
  latencyMs?: number | null;
  risk?: string;
  chosen?: boolean;
  reason?: string;
  [key: string]: unknown;
}

export interface RouteDecisionView {
  id?: string;
  taskId?: string;
  taskPath?: string;
  agentId?: string;
  model?: string;
  thinking?: string;
  quality?: number | null;
  qualitySource?: string;
  sampleSize?: number | null;
  costUsd?: number | null;
  latencyMs?: number | null;
  risk?: string;
  chosen?: boolean;
  reason?: string;
  candidates?: RouteCandidateView[];
  refusals?: string[];
  fallbacks?: string[];
  [key: string]: unknown;
}

export interface RoutingView {
  decisions?: RouteDecisionView[];
  refusals?: Array<Record<string, unknown> | string>;
  allocatedCostUsd?: number | null;
  reserveUsd?: number | null;
  skippedTasks?: string[];
  [key: string]: unknown;
}

export interface ContextItemView {
  id?: string;
  path?: string;
  kind?: string;
  chars?: number;
  tokens?: number;
  mandatory?: boolean;
  hash?: string;
  reason?: string;
  included?: boolean;
  [key: string]: unknown;
}

export interface ContextPackView {
  id?: string;
  taskId?: string;
  agentId?: string;
  maxTokens?: number;
  usedTokens?: number;
  prefixHash?: string;
  cacheable?: boolean;
  items?: ContextItemView[];
  [key: string]: unknown;
}

export interface ContextView {
  packs?: ContextPackView[];
  items?: ContextItemView[];
  [key: string]: unknown;
}

export interface FailureClusterView {
  id?: string;
  signature?: string;
  category?: string;
  language?: string;
  count?: number;
  severity?: string;
  priority?: number | null;
  repairStatus?: string;
  [key: string]: unknown;
}

export interface FailuresView {
  clusters?: FailureClusterView[];
  signatures?: FailureClusterView[];
  [key: string]: unknown;
}

export interface RetryAttemptView {
  id?: string;
  taskId?: string;
  attempt?: number;
  action?: string;
  decision?: string;
  reason?: string;
  costUsd?: number | null;
  createdAt?: string;
  [key: string]: unknown;
}

export interface RetriesView {
  attempts?: RetryAttemptView[];
  [key: string]: unknown;
}

export interface ConfidenceView {
  decision?: string;
  score?: number | null;
  provisional?: boolean;
  components?: Record<string, number | null>;
  mandatoryFailed?: string[];
  mandatoryUnverified?: string[];
  reasons?: string[];
  [key: string]: unknown;
}

export interface LearningOverview {
  enabled: boolean;
  reason?: string;
  consentRequired?: boolean;
  phase?: string;
  screeningLabel?: string;
  counts?: Record<string, number | null>;
  consent?: Record<string, boolean | null>;
  lastEvalAt?: string | null;
  [key: string]: unknown;
}

export interface LearningRecord {
  id?: string;
  [key: string]: unknown;
}

export interface ApprovalRequest {
  action: 'promote' | 'rollback';
  candidateId?: string;
  evaluationId?: string;
  promotionId?: string;
  typedPhrase: 'APPROVE';
}

export interface ApprovalResponse {
  approvalToken: string;
  expiresAt?: string;
  tokenId?: string;
}

export interface VaultNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: VaultNode[];
}

export interface VaultTreeResponse {
  tree?: VaultNode[];
  nodes?: VaultNode[];
}

export interface RawRecord {
  [key: string]: unknown;
}

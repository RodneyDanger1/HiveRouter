export interface RefusalDefinition {
  http: number;
  exit: number;
  retryable: boolean;
  message: string;
  hint?: string;
}

export const REFUSALS = {
  E_ACTIVE_RUN_EXISTS: { http: 409, exit: 4, retryable: false, message: 'Another factory run is already active.', hint: 'Wait for it to finish or cancel it first.' },
  E_IDEMPOTENCY_KEY_REQUIRED: { http: 422, exit: 2, retryable: false, message: 'Idempotency-Key is required for this mutation.', hint: 'Send a 16-128 character key.' },
  E_IDEMPOTENCY_KEY_REUSED: { http: 409, exit: 4, retryable: false, message: 'Idempotency-Key was reused with a different body.', hint: 'Use a new key for a different request.' },
  E_INVALID_PARENT: { http: 409, exit: 4, retryable: false, message: 'Parent run is not terminal or has no artifacts.', hint: 'Choose a completed or failed run with files.' },
  E_INVALID_RUN_INPUT: { http: 422, exit: 2, retryable: false, message: 'The run input contains an unsupported preset, model, thinking mode, or effort value.', hint: 'Use one of the documented enum values.' },
  E_INVALID_RUN_FILTER: { http: 422, exit: 2, retryable: false, message: 'The run filter contains an unsupported status value.', hint: 'Use one of the documented run statuses or omit the filter.' },
  E_INVALID_AGENT_RUN_INPUT: { http: 422, exit: 2, retryable: false, message: 'The ad-hoc agent run input is invalid.', hint: 'Use a supported mode and a non-empty input.' },
  E_INVALID_REVISION_SCOPE: { http: 422, exit: 2, retryable: false, message: 'The revision file selection contains a path that is not a parent artifact.' },
  E_PROMPT_TOO_LARGE: { http: 422, exit: 2, retryable: false, message: 'Prompt override exceeds the size limit.' },
  E_PROMPT_OVERRIDE_INVALID: { http: 422, exit: 2, retryable: false, message: 'The prompt override violates the role/objective contract.' },
  E_UNSUPPORTED_AGENT: { http: 404, exit: 3, retryable: false, message: 'Unknown agent id.' },
  E_AGENT_OUTPUT_MISMATCH: { http: 422, exit: 2, retryable: false, message: 'The agent cannot produce the requested output kind.' },
  E_AGENT_TARGET_REQUIRED: { http: 422, exit: 2, retryable: false, message: 'A target path is required for file-writing agents.' },
  E_AGENT_OUTPUT_EMPTY: { http: 422, exit: 4, retryable: false, message: 'The agent returned no output files.' },
  E_AGENT_MOCK_UNAVAILABLE: { http: 422, exit: 6, retryable: false, message: 'Mock mode is test-only and is not available in the product runtime.', hint: 'Use live mode with a configured key.' },
  E_UNSAFE_PATH: { http: 422, exit: 2, retryable: false, message: 'Path escapes the allowed root or uses a reserved name.' },
  E_FILE_NOT_FOUND: { http: 404, exit: 3, retryable: false, message: 'File not found in this run.' },
  E_FILE_TOO_LARGE: { http: 413, exit: 2, retryable: false, message: 'Generated file exceeds the byte limit.' },
  E_RUN_NOT_FOUND: { http: 404, exit: 3, retryable: false, message: 'Run not found.' },
  E_RUN_NOT_TERMINAL: { http: 409, exit: 4, retryable: false, message: 'The run is not terminal yet.' },
  E_RUN_NOT_CANCELLABLE: { http: 409, exit: 4, retryable: false, message: 'The run is not cancellable in its current state.' },
  E_RUN_INTERRUPTED: { http: 409, exit: 4, retryable: false, message: 'The run was interrupted by a server restart.' },
  E_ZIP_EMPTY: { http: 422, exit: 2, retryable: false, message: 'The run has no artifacts to download.' },
  E_ZIP_PATH: { http: 422, exit: 2, retryable: false, message: 'Unsafe archive entry.' },
  E_OPEN_FOLDER_UNSUPPORTED: { http: 501, exit: 7, retryable: false, message: 'Opening a folder is only supported on Windows.' },
  E_OPEN_FOLDER_FAILED: { http: 500, exit: 9, retryable: true, message: 'The operating system could not open the run folder.' },
  E_ANALYSIS_INVALID_INPUT: { http: 422, exit: 2, retryable: false, message: 'The static analysis request is invalid or exceeds its bounds.' },
  E_SEARCH_INVALID_QUERY: { http: 422, exit: 2, retryable: false, message: 'The workspace search query is invalid or exceeds its bounds.' },
  E_RESUME_NO_STAGED_FILES: { http: 409, exit: 4, retryable: false, message: 'This run has no retained staged files to resume.' },
  E_DSH_CONSENT_REQUIRED: { http: 403, exit: 5, retryable: false, message: 'DSH credential-store consent was not granted.', hint: 'Use .env.local or the local key import instead; the runtime never reads DSH.' },
  E_DSH_CREDENTIAL_INVALID: { http: 422, exit: 2, retryable: false, message: 'The credential source is malformed.' },
  E_KEY_NOT_CONFIGURED: { http: 503, exit: 7, retryable: false, message: 'No DeepSeek API key is configured.', hint: 'Add DEEPSEEK_API_KEY to .env.local or data/secrets.json.' },
  E_KEY_INVALID: { http: 401, exit: 5, retryable: false, message: 'The DeepSeek API key was rejected.' },
  E_BALANCE_LOW: { http: 402, exit: 8, retryable: false, message: 'DeepSeek account balance is insufficient.' },
  E_BUDGET_EXCEEDED: { http: 409, exit: 8, retryable: false, message: 'The budget cap was exceeded.' },
  E_BUDGET_UNKNOWN_RESERVATION: { http: 409, exit: 8, retryable: false, message: 'A reservation has unknown cost.', hint: 'Reconcile or release the reservation.' },
  E_BUDGET_DUPLICATE_RESERVATION: { http: 409, exit: 4, retryable: false, message: 'A reservation with this id already exists.' },
  E_BUDGET_INVALID_AMOUNT: { http: 422, exit: 2, retryable: false, message: 'Budget amounts must be non-negative integer micro-USD.' },
  E_BUDGET_INFEASIBLE: { http: 409, exit: 8, retryable: false, message: 'The requested call does not fit the remaining budget.' },
  E_BUDGET_INVALID_LIMIT: { http: 422, exit: 2, retryable: false, message: 'The run cost limit must be a positive USD amount no greater than the configured cap.' },
  E_BUDGET_OVERCOMMIT: { http: 409, exit: 8, retryable: false, message: 'Actual cost exceeded the reservation.' },
  E_ROUTE_BUDGET_INFEASIBLE: { http: 409, exit: 8, retryable: false, message: 'No feasible route fits the budget.' },
  E_ROUTING_DISABLED: { http: 403, exit: 5, retryable: false, message: 'Deterministic routing is disabled in this release phase.', hint: 'Run phase B1/B2 or enable routing.' },
  E_NO_CAPABLE_AGENT: { http: 422, exit: 6, retryable: false, message: 'No registered agent can perform this task.' },
  E_ALL_CANDIDATES_DISABLED: { http: 422, exit: 6, retryable: false, message: 'All candidate agents are disabled.' },
  E_DAG_CYCLE_DETECTED: { http: 422, exit: 6, retryable: false, message: 'The file dependency graph contains a cycle.' },
  E_MISSING_DEPENDENCY: { http: 422, exit: 6, retryable: false, message: 'A required task depends on a skipped task.' },
  E_RISK_UNVERIFIABLE: { http: 422, exit: 6, retryable: false, message: 'A high-risk task requires a check the platform cannot run.' },
  E_CONTEXT_INFEASIBLE: { http: 422, exit: 6, retryable: false, message: 'Mandatory context exceeds the context budget.' },
  E_POLICY_BLOCKED: { http: 403, exit: 5, retryable: false, message: 'Policy blocked this action.' },
  E_EXPLORATION_NOT_ALLOWED: { http: 403, exit: 5, retryable: false, message: 'Live routing exploration is not allowed.' },
  E_REPAIR_STALLED: { http: 422, exit: 6, retryable: false, message: 'Repair made no progress; the run stops.' },
  E_REPAIR_BUDGET_EXHAUSTED: { http: 422, exit: 6, retryable: false, message: 'Repair attempt budget is exhausted.' },
  E_REPAIR_NO_STRATEGY: { http: 422, exit: 6, retryable: false, message: 'No repair strategy is available.' },
  E_REPAIR_UNSAFE_TARGET: { http: 422, exit: 2, retryable: false, message: 'Repair target failed path safety.' },
  E_VERIFY_TOOL_UNAVAILABLE: { http: 503, exit: 7, retryable: false, message: 'A mandatory verification tool is unavailable.' },
  E_CONFIDENCE_ABSTAIN: { http: 200, exit: 0, retryable: false, message: 'Confidence is provisional; the run needs review.' },
  E_RETRY_INFEASIBLE: { http: 422, exit: 6, retryable: false, message: 'No retry or switch action has positive expected value.' },
  E_LOOP_GUARD_TRIPPED: { http: 409, exit: 4, retryable: false, message: 'The loop guard detected no progress or runaway spend.' },
  E_GATE_POLICY_INVALID: { http: 500, exit: 9, retryable: false, message: 'Invalid gate policy.' },
  E_GATE_CONTRADICTION: { http: 500, exit: 9, retryable: false, message: 'Gate inputs contradict each other.' },
  E_STAGE_LEAK: { http: 500, exit: 9, retryable: false, message: 'A later-phase artifact is present in this release stage.' },
  E_RESOURCE_INSUFFICIENT: { http: 503, exit: 7, retryable: false, message: 'Host resources are below the preflight floor.' },
  E_E2E_BROWSER_MISSING: { http: 503, exit: 7, retryable: false, message: 'System Chrome was not found for E2E.' },
  E_LEARNING_DISABLED: { http: 403, exit: 5, retryable: false, message: 'Learning is disabled.', hint: 'Enable it in Settings and grant the consent scopes.' },
  E_LEARNING_CONSENT_REQUIRED: { http: 403, exit: 5, retryable: false, message: 'Learning consent is required.' },
  E_LEARNING_RUN_NOT_TERMINAL: { http: 409, exit: 4, retryable: false, message: 'Only terminal traces can enter learning.' },
  E_LEARNING_NO_BASELINE: { http: 422, exit: 6, retryable: false, message: 'No frozen baseline is available.' },
  E_LEARNING_DATASET_EMPTY: { http: 422, exit: 6, retryable: false, message: 'The dataset or sealed pool is empty.' },
  E_LEARNING_INSUFFICIENT_SAMPLE: { http: 422, exit: 6, retryable: false, message: 'Fewer than 50 paired holdout cases; no promotion is possible.' },
  E_LEARNING_SUITE_ALREADY_USED: { http: 409, exit: 4, retryable: false, message: 'This suite has already been claimed by another evaluation.' },
  E_LEARNING_POOL_EXHAUSTED: { http: 422, exit: 6, retryable: false, message: 'No sealed 65-case block remains.' },
  E_LEARNING_REDACTION_BLOCKED: { http: 422, exit: 6, retryable: false, message: 'A trace or artifact could not be safely redacted.' },
  E_LEARNING_EVIDENCE_TAMPERED: { http: 409, exit: 4, retryable: false, message: 'Evidence or suite hash does not match.' },
  E_LEARNING_APPROVAL_REQUIRED: { http: 403, exit: 5, retryable: false, message: 'A single-use approval token is required.' },
  E_LEARNING_APPROVAL_EXPIRED: { http: 403, exit: 5, retryable: false, message: 'The approval token is expired or already consumed.' },
  E_LEARNING_VERSION_DRIFT: { http: 409, exit: 4, retryable: false, message: 'The active baseline changed after the candidate was created.' },
  E_LEARNING_PROMOTION_REFUSED: { http: 422, exit: 6, retryable: false, message: 'The screening gate did not pass; no promotion.' },
  E_LEARNING_ROLLBACK_UNAVAILABLE: { http: 422, exit: 6, retryable: false, message: 'No valid last-known-good policy is available.' },
  E_LEARNING_UNSAFE_THRESHOLD: { http: 422, exit: 6, retryable: false, message: 'A candidate attempts to weaken a mandatory safety check.' },
  E_LEARNING_CANDIDATE_INVALID: { http: 422, exit: 6, retryable: false, message: 'The candidate failed schema or lint validation.' },
  E_LEARNING_ROUTE_POLICY_FORBIDDEN: { http: 422, exit: 6, retryable: false, message: 'Route-policy learning is not allowed.' },
  E_EVAL_ISOLATION: { http: 403, exit: 5, retryable: false, message: 'The eval worker attempted to read production data.' },
  E_SCRIPT_DRY_RUN_UNSUPPORTED: { http: 422, exit: 2, retryable: false, message: 'This script cannot be dry-run in-process.' },
  E_REPORT_NOT_FOUND: { http: 404, exit: 3, retryable: false, message: 'Report not found.' },
  E_PROMPT_ANALYSIS_INVALID: { http: 422, exit: 6, retryable: true, message: 'The prompt analysis could not preserve exact evidence for its stated claims.', hint: 'Retry the analysis; no unverified interpretation was saved.' },
  E_ORIGIN_FORBIDDEN: { http: 403, exit: 5, retryable: false, message: 'Request origin or Host is not allowed.' },
  E_CONTENT_TYPE_REQUIRED: { http: 415, exit: 2, retryable: false, message: 'JSON mutations require application/json.' },
  E_REPLAY_WINDOW_EXCEEDED: { http: 410, exit: 4, retryable: false, message: 'The requested event is outside the replay window.', hint: 'Use the snapshot endpoint.' },
  E_ILLEGAL_RUN_TRANSITION: { http: 409, exit: 4, retryable: false, message: 'Illegal run state transition.' },
  E_CHAT_THREAD_NOT_FOUND: { http: 404, exit: 3, retryable: false, message: 'Chat thread not found.' },
  E_CHAT_JOB_NOT_FOUND: { http: 404, exit: 3, retryable: false, message: 'Chat job not found.' },
  E_CHAT_INVALID_INPUT: { http: 422, exit: 2, retryable: false, message: 'The chat request contains an invalid title, message, agent, or selection.' },
  E_CHAT_JOB_NOT_CANCELLABLE: { http: 409, exit: 4, retryable: false, message: 'The chat job is not cancellable in its current state.' },
  E_CHAT_JOB_EXHAUSTED: { http: 409, exit: 4, retryable: false, message: 'The chat job exhausted its attempts without a durable answer.' },
  E_CHAT_JOB_CANCELLED: { http: 409, exit: 4, retryable: false, message: 'The owner cancelled this chat job.' },
  E_CHAT_JOB_TIMEOUT: { http: 504, exit: 7, retryable: true, message: 'The chat job exceeded its lease-safe execution window.' },
  E_INTERNAL: { http: 500, exit: 9, retryable: false, message: 'Internal error.' },
  FORBIDDEN_PROVIDER_KEY_ACCESS: { http: 403, exit: 5, retryable: false, message: 'Provider key access over HTTP is forbidden.' },
  FORBIDDEN_SHELL: { http: 403, exit: 5, retryable: false, message: 'Arbitrary shell execution is forbidden.' },
  FORBIDDEN_AUTO_PROMOTION: { http: 403, exit: 5, retryable: false, message: 'Automatic promotion is forbidden.' },
} as const satisfies Record<string, RefusalDefinition>;

export type RefusalCode = keyof typeof REFUSALS;

export function refusal(code: RefusalCode): RefusalDefinition {
  return REFUSALS[code];
}

export function isRefusalCode(value: string): value is RefusalCode {
  return Object.prototype.hasOwnProperty.call(REFUSALS, value);
}

/**
 * Resolve the run-domain error identity from a thrown value. A real LlmError
 * carries its code in `.code`; only codes with the E_ run-domain shape qualify,
 * so a Node errno (ENOENT/ECONNREFUSED/ENOSPC) can never become a run error
 * code. Fall back to a leading E_ token in the message, then E_INTERNAL.
 */
export function codeOfError(error: unknown): string {
  const candidate = (error as { code?: unknown } | null | undefined)?.code;
  if (typeof candidate === 'string' && /^E_[A-Z0-9_]+$/.test(candidate)) return candidate;
  const message = error instanceof Error ? error.message : String(error);
  const prefixed = /^(E_[A-Z0-9_]+)/.exec(message);
  return prefixed ? prefixed[1] : 'E_INTERNAL';
}


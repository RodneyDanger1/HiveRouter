/**
 * CRA — cost-aware retry/switch allocator (P6a A5).
 *
 * All money is USD. EV = pSuccess * value - costUsd - lambdaUsdPerSec * expectedSeconds.
 * There is no cross-run learning; priors are static and the current attempt can
 * move the prior by at most 0.05. A null budget is never treated as zero.
 */
import {
  AlgorithmRefusal,
  FINISH_REASONS,
  FinishReason,
  RepairAction,
  RetryCandidate,
  RetryDecision,
  RetryDecisionSchema,
  RetryRequest,
  RetryRequestSchema,
  STATIC_PSUCCESS_PRIORS,
  clamp,
} from '../../shared/algorithms';

const NO_RETRY = new Set<string>(['auth', 'budget', 'path', 'permission', 'policy']);
const ACTION_ORDER: Record<RepairAction, number> = {
  retry_same: 0,
  switch_agent: 1,
  switch_model: 2,
  escalate_thinking: 3,
  abort: 4,
};

interface EvaluatedAction {
  action: RepairAction;
  candidate?: RetryCandidate;
  pSuccess: number;
  costUsd: number;
  expectedSeconds: number;
  ev: number;
}

function refusal(code: AlgorithmRefusal['code'], message: string, details: Record<string, unknown> = {}): AlgorithmRefusal {
  return { code, message, details };
}

function priorFor(category: string, action: RepairAction): number {
  return STATIC_PSUCCESS_PRIORS[`${category}:${action}`] ?? STATIC_PSUCCESS_PRIORS[`${category}:retry_same`] ?? 0.3;
}

function baseDecision(
  request: RetryRequest,
  action: RepairAction,
  reason: string,
  refusalCode?: AlgorithmRefusal['code'],
  candidate?: RetryCandidate,
  expectedCostUsd = 0,
  expectedValue = 0,
  backoffMs?: number,
): RetryDecision {
  return RetryDecisionSchema.parse({
    taskId: request.taskId,
    attempt: request.attempt,
    action,
    ...(candidate ? { candidate } : {}),
    expectedCostUsd,
    expectedValue,
    reason,
    ...(refusalCode ? { refusalCode } : {}),
    ...(backoffMs !== undefined ? { backoffMs } : {}),
  });
}

function currentCandidate(request: RetryRequest): RetryCandidate {
  return {
    agentId: request.currentAgentId,
    model: request.currentModel,
    thinking: request.currentThinking,
    costUsd: request.currentCostUsd,
    expectedSeconds: request.currentExpectedSeconds,
    quality: 0.5,
    maxOutputTokens: 65_536,
    capabilityFiltered: true,
  };
}

function evaluate(
  request: RetryRequest,
  action: RepairAction,
  candidate: RetryCandidate | undefined,
  value: number,
): EvaluatedAction {
  const pSuccess = clamp(priorFor(request.failureCategory, action) + request.attemptEvidence * 0.05, 0.05, 0.95);
  const costUsd = candidate?.costUsd ?? 0;
  const expectedSeconds = candidate?.expectedSeconds ?? 0;
  const ev = pSuccess * value - costUsd - request.lambdaUsdPerSec * expectedSeconds;
  return { action, candidate, pSuccess, costUsd, expectedSeconds, ev };
}

export function decideRetry(raw: unknown): RetryDecision {
  const request = RetryRequestSchema.parse(raw) as RetryRequest;

  if (
    request.budget === null ||
    request.budget.spentUsd === null ||
    request.budget.remainingUsd === null ||
    request.budget.reserveUsd === null
  ) {
    return baseDecision(
      request,
      'abort',
      'Budget state is unknown; a retry cannot be costed.',
      'E_BUDGET_UNKNOWN_RESERVATION',
    );
  }

  if (NO_RETRY.has(request.failureCategory)) {
    const code =
      request.failureCategory === 'auth'
        ? 'E_KEY_INVALID'
        : request.failureCategory === 'budget'
          ? 'E_BUDGET_EXCEEDED'
          : 'E_POLICY_BLOCKED';
    return baseDecision(request, 'abort', `Failure category ${request.failureCategory} is not retryable.`, code);
  }

  if (request.repairsDone >= request.maxRepairs) {
    return baseDecision(request, 'abort', 'Repair attempt budget is exhausted.', 'E_REPAIR_BUDGET_EXHAUSTED');
  }
  if (request.attempt >= request.maxAttempts) {
    return baseDecision(request, 'abort', 'Attempt budget is exhausted.', 'E_RETRY_INFEASIBLE');
  }

  if (request.finishReason === 'content_filter') {
    return baseDecision(request, 'abort', 'The provider blocked the content; retrying would repeat it.');
  }
  if (request.finishReason === 'aborted' || request.finishReason === 'insufficient_system_resource') {
    const backoffMs = Math.min(30_000, 1_000 * 2 ** (request.attempt - 1));
    const pSuccess = clamp(priorFor(request.failureCategory, 'retry_same') + request.attemptEvidence * 0.05, 0.05, 0.95);
    const value = request.riskTier === 'T0' || request.riskTier === 'T1' ? 1.5 : 1;
    const ev = pSuccess * value - request.currentCostUsd - request.lambdaUsdPerSec * request.currentExpectedSeconds;
    return baseDecision(
      request,
      'retry_same',
      `Provider interrupted generation (${request.finishReason}); retry the same call.`,
      undefined,
      currentCandidate(request),
      request.currentCostUsd,
      Number(ev.toFixed(6)),
      backoffMs,
    );
  }

  const candidates = request.candidates.filter((candidate) => candidate.capabilityFiltered);
  const current = currentCandidate(request);
  const value = request.riskTier === 'T0' || request.riskTier === 'T1' ? 1.5 : 1;
  const actions: EvaluatedAction[] = [];

  if (request.finishReason === 'length') {
    const larger = candidates
      .filter((candidate) => candidate.maxOutputTokens > current.maxOutputTokens)
      .sort((a, b) => b.maxOutputTokens - a.maxOutputTokens || a.agentId.localeCompare(b.agentId))[0];
    if (larger) actions.push(evaluate(request, 'switch_model', larger, value));
    else actions.push(evaluate(request, 'retry_same', current, value));
  } else if (request.finishReason === 'stop' || request.failureCategory === 'syntax' || request.failureCategory === 'type') {
    actions.push(evaluate(request, 'retry_same', current, value));
    for (const candidate of candidates) {
      if (candidate.agentId !== request.currentAgentId) actions.push(evaluate(request, 'switch_agent', candidate, value));
      if (candidate.model !== request.currentModel) actions.push(evaluate(request, 'switch_model', candidate, value));
      if (candidate.thinking === 'enabled' && request.currentThinking === 'disabled') {
        actions.push(evaluate(request, 'escalate_thinking', candidate, value));
      }
    }
  } else if (request.failureCategory === 'verification') {
    for (const candidate of candidates) {
      if (candidate.agentId !== request.currentAgentId) actions.push(evaluate(request, 'switch_agent', candidate, value));
    }
  } else if (request.failureCategory === 'test-assert' || request.failureCategory === 'runtime') {
    actions.push(evaluate(request, 'retry_same', current, value));
    for (const candidate of candidates) {
      if (candidate.agentId !== request.currentAgentId) actions.push(evaluate(request, 'switch_agent', candidate, value));
    }
  } else {
    actions.push(evaluate(request, 'retry_same', current, value));
    for (const candidate of candidates) {
      if (candidate.agentId !== request.currentAgentId) actions.push(evaluate(request, 'switch_agent', candidate, value));
    }
  }

  const affordable = actions.filter((action) => action.costUsd <= (request.budget as { remainingUsd: number }).remainingUsd);
  const best = affordable
    .filter((action) => action.ev > 0)
    .sort(
      (a, b) =>
        b.ev - a.ev ||
        a.costUsd - b.costUsd ||
        ACTION_ORDER[a.action] - ACTION_ORDER[b.action] ||
        (a.candidate?.agentId ?? '').localeCompare(b.candidate?.agentId ?? ''),
    )[0];

  if (!best) {
    return baseDecision(
      request,
      'abort',
      'No retry or switch action has positive expected value within the remaining budget.',
      'E_RETRY_INFEASIBLE',
    );
  }

  const backoffMs =
    best.action === 'retry_same' &&
    (request.failureCategory === 'rate-limit' || request.failureCategory === 'timeout')
      ? Math.min(30_000, 1_000 * 2 ** (request.attempt - 1))
      : undefined;
  return baseDecision(
    request,
    best.action,
    `EV ${best.ev.toFixed(6)} USD, pSuccess ${best.pSuccess.toFixed(3)}, cost ${best.costUsd.toFixed(6)} USD.`,
    undefined,
    best.candidate,
    best.costUsd,
    Number(best.ev.toFixed(6)),
    backoffMs,
  );
}

export { priorFor, NO_RETRY, FINISH_REASONS, type FinishReason };

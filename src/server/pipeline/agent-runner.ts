import { z } from 'zod';
import type { AgentId, Effort, ModelId, RunSnapshot, ThinkingMode, UsageRecord } from '../../shared/types.js';
import { getAgent, engineForPath } from '../agents/registry.js';
import { buildSystemPrompt } from '../agents/prompts.js';
import { chatJson, chat, DeepSeekError, type ChatMessage } from '../llm/client.js';
import { reserveLlmCall, maxAffordableOutputTokens, commitLlmCall, releaseLlmCall } from '../runs/manager.js';

export interface AgentRuntimeOverride {
  model?: ModelId;
  thinking?: ThinkingMode;
  effort?: Effort | null;
}

export interface AgentCallOptions extends AgentRuntimeOverride {
  signal?: AbortSignal;
  userId?: string;
  onUsage?: (usage: UsageRecord) => void;
  onText?: (text: string) => void;
}

export interface AgentRuntime {
  thinking: ThinkingMode;
  effort?: Effort;
  temperature?: number;
}

function runtimeFor(
  agentId: string,
  snapshot: RunSnapshot,
  override: AgentRuntimeOverride = {},
): AgentRuntime {
  // Explicit route/runtime override wins; otherwise the user's immutable
  // snapshot is authoritative. No agent may silently re-enable thinking that
  // the user disabled, or ignore a routed model/thinking/effort choice.
  const thinking = override.thinking ?? snapshot.thinking;
  const effort = thinking === 'enabled' ? override.effort ?? snapshot.effort ?? 'high' : undefined;
  return {
    thinking,
    ...(effort ? { effort } : {}),
    ...(thinking === 'disabled' ? { temperature: 0.2 } : {}),
  };
}

export async function callAgentJson<T>(
  agentId: AgentId,
  snapshot: RunSnapshot,
  userPrompt: string,
  schema: z.ZodType<T>,
  options: AgentCallOptions = {},
): Promise<{ data: T; usage: UsageRecord; content: string }> {
  const agent = getAgent(agentId);
  if (!agent) throw new DeepSeekError('E_UNSUPPORTED_AGENT', `unknown agent ${agentId}`, 404, false);
  const promptVersion = snapshot.promptVersions.find((p) => p.agentId === agentId);
  const systemPrompt = promptVersion?.text ?? buildSystemPrompt(agent);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  const runtime = runtimeFor(agentId, snapshot, options);
  const model: ModelId = options.model ?? snapshot.model;
  const requestedMaxTokens = Math.min(agent.maxOutputTokens, Number(snapshot.limits.maxOutputTokens ?? 32768));
  let reservationId: string | null = null;
  const totals: { usage: UsageRecord | null } = { usage: null };
  const mergeUsage = (usage: UsageRecord): void => {
    totals.usage = totals.usage
      ? {
          ...totals.usage,
          promptTokens: totals.usage.promptTokens + usage.promptTokens,
          completionTokens: totals.usage.completionTokens + usage.completionTokens,
          cacheHitTokens: totals.usage.cacheHitTokens + usage.cacheHitTokens,
          cacheMissTokens: totals.usage.cacheMissTokens + usage.cacheMissTokens,
          reasoningTokens: totals.usage.reasoningTokens + usage.reasoningTokens,
          costUsd: totals.usage.costUsd + usage.costUsd,
        }
      : usage;
    options.onUsage?.(usage);
  };
  const onHttpAttemptStart = (_attempt: number, requestChars = 0): void => {
    const fitted = maxAffordableOutputTokens(
      snapshot.runId,
      Math.max(systemPrompt.length + userPrompt.length, requestChars),
      requestedMaxTokens,
      model,
    );
    reservationId = reserveLlmCall(
      snapshot.runId,
      Math.max(systemPrompt.length + userPrompt.length, requestChars),
      fitted,
      model,
    );
  };
  const onHttpAttemptEnd = (_attempt: number, usage: UsageRecord | null): void => {
    // Every actual HTTP attempt has its own reservation. Capture usage before
    // settling so a failed/retried request cannot hide spend or hold the
    // previous attempt's reservation.
    if (usage) mergeUsage(usage);
    if (!reservationId) return;
    // Clear before committing: commit can throw E_BUDGET_OVERCOMMIT after it
    // has already updated the row. A second end-hook (client success + catch)
    // must not try to settle the same reservation again.
    const id = reservationId;
    reservationId = null;
    commitLlmCall(id, usage?.costUsd ?? 0);
  };
  try {
    const data = await chatJson(schema, messages, {
      model,
      thinking: runtime.thinking,
      effort: runtime.effort,
      maxTokens: requestedMaxTokens,
      temperature: runtime.temperature,
      userId: options.userId ?? `hive-${snapshot.runId}-${agentId}`,
      signal: options.signal,
      onHttpAttemptStart,
      onHttpAttemptEnd,
    });
    return { data, usage: totals.usage ?? emptyUsage(model), content: JSON.stringify(data) };
  } catch (error) {
    if (reservationId) releaseLlmCall(reservationId);
    throw error;
  }
}

export async function callAgentText(
  agentId: AgentId,
  snapshot: RunSnapshot,
  userPrompt: string,
  options: AgentCallOptions = {},
): Promise<{ text: string; usage: UsageRecord }> {
  const agent = getAgent(agentId);
  if (!agent) throw new DeepSeekError('E_UNSUPPORTED_AGENT', `unknown agent ${agentId}`, 404, false);
  const promptVersion = snapshot.promptVersions.find((p) => p.agentId === agentId);
  const systemPrompt = promptVersion?.text ?? buildSystemPrompt(agent);
  const requestedMaxTokens = Math.min(agent.maxOutputTokens, 8192);
  const maxTokens = maxAffordableOutputTokens(
    snapshot.runId,
    systemPrompt.length + userPrompt.length,
    requestedMaxTokens,
    snapshot.model,
  );
  const runtime = runtimeFor(agentId, snapshot, options);
  let reservationId: string | null = null;
  const onHttpAttemptStart = (_attempt: number, requestChars = 0): void => {
    reservationId = reserveLlmCall(
      snapshot.runId,
      Math.max(systemPrompt.length + userPrompt.length, requestChars),
      maxTokens,
      snapshot.model,
    );
  };
  const onHttpAttemptEnd = (_attempt: number, usage: UsageRecord | null): void => {
    if (!reservationId) return;
    const id = reservationId;
    reservationId = null;
    commitLlmCall(id, usage?.costUsd ?? 0);
  };
  try {
    const result = await chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        model: options.model ?? snapshot.model,
        thinking: runtime.thinking,
        effort: runtime.effort,
        temperature: runtime.temperature,
        maxTokens,
        userId: options.userId ?? `hive-${snapshot.runId}-${agentId}`,
        signal: options.signal,
        onHttpAttemptStart,
        onHttpAttemptEnd,
      },
    );
    options.onUsage?.(result.usage);
    options.onText?.(result.content);
    return { text: result.content, usage: result.usage };
  } catch (error) {
    if (reservationId) releaseLlmCall(reservationId);
    throw error;
  }
}

export function engineForTask(path: string, duty: string, hint?: string): AgentId {
  return engineForPath(path, duty, hint);
}

function emptyUsage(model: string): UsageRecord {
  return {
    promptTokens: 0,
    completionTokens: 0,
    cacheHitTokens: 0,
    cacheMissTokens: 0,
    reasoningTokens: 0,
    costUsd: 0,
    source: 'unknown',
    model,
  };
}

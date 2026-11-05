import { config } from '../config.js';
import { getAgent } from '../agents/registry.js';
import { buildSystemPrompt } from '../agents/prompts.js';
import { chat, LlmError, type ChatMessage } from '../llm/client.js';
import { estimateCallMicroUsd, reserve, commit, release } from '../runs/budget.js';
import { getDb } from '../db/database.js';
import { chatHistoryForJob } from './store.js';

export type ChatUsage = { costUsd: number; promptTokens: number; completionTokens: number };

export type GenerateChatReplyInput = {
  jobId: string;
  threadId: string;
  userMessageId: string;
  agentId: string;
  model: string;
  thinking: 'enabled' | 'disabled';
  effort: 'low' | 'high' | 'max' | null;
  signal: AbortSignal;
  onUsage?: (usage: ChatUsage) => void;
};

export type GenerateChatReplyResult = { text: string; usage: ChatUsage };

function systemPromptFor(agentId: string): string {
  const agent = getAgent(agentId);
  if (!agent) throw new Error('E_UNSUPPORTED_AGENT');
  const override = getDb()
    .prepare('SELECT value_json FROM settings WHERE key = ?')
    .get(`prompt_override:${agentId}`) as { value_json: string } | undefined;
  if (override) {
    try {
      const parsed = JSON.parse(override.value_json) as { prompt?: unknown };
      if (typeof parsed.prompt === 'string' && parsed.prompt.trim().length > 0) return parsed.prompt;
    } catch {
      // fall back to the registry prompt; the save route validated the JSON
    }
  }
  return buildSystemPrompt(agent);
}

function usageFrom(result: { costUsd: number; promptTokens: number; completionTokens: number }): ChatUsage {
  return {
    costUsd: result.costUsd,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
  };
}

/**
 * One real provider call for a durable chat job. Budget reservations are scoped
 * to the cycle ledger and settled on every HTTP attempt; a failed provider call
 * never leaves a reservation held.
 */
export async function generateChatReply(input: GenerateChatReplyInput): Promise<GenerateChatReplyResult> {
  const agent = getAgent(input.agentId);
  if (!agent) throw new Error('E_UNSUPPORTED_AGENT');
  const basePrompt = systemPromptFor(input.agentId);
  const systemPrompt = `${basePrompt}\n\n--- LIVE CHAT MODE ---\nAnswer the owner's message directly in concise prose. Do not claim that code was executed, files were written, tests ran, or a provider action completed unless this conversation actually did so. If the owner asks for a coding deliverable, describe the exact artifact and use the normal run UI for generation; do not fabricate a completed run.`;
  const history = chatHistoryForJob(input.threadId, input.userMessageId);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((message) => ({ role: message.role, content: message.content })),
  ];
  const promptChars = messages.reduce((total, message) => total + message.content.length, 0);
  const requestedMaxTokens = Math.max(512, Math.min(agent.maxOutputTokens, config.chat.maxOutputTokens));
  let reservationId: string | null = null;
  let totals: ChatUsage | null = null;
  const addUsage = (usage: { costUsd: number; promptTokens: number; completionTokens: number }): void => {
    totals = totals
      ? {
          costUsd: totals.costUsd + usage.costUsd,
          promptTokens: totals.promptTokens + usage.promptTokens,
          completionTokens: totals.completionTokens + usage.completionTokens,
        }
      : usageFrom(usage);
    input.onUsage?.(totals);
  };

  const onHttpAttemptStart = (_attempt: number, requestChars = 0): void => {
    const chars = Math.max(promptChars, requestChars);
    const estimate = estimateCallMicroUsd(chars, requestedMaxTokens, input.model);
    const id = `res_chat_${input.jobId}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    reserve({ id, scope: 'cycle', ownerRunId: input.jobId, amountMicroUsd: estimate, ttlMs: 15 * 60 * 1000 });
    reservationId = id;
  };

  const onHttpAttemptEnd = (_attempt: number, usage: { costUsd: number; promptTokens: number; completionTokens: number } | null): void => {
    if (usage) addUsage(usage);
    if (!reservationId) return;
    const id = reservationId;
    reservationId = null;
    // Unknown usage commits the reserved worst case rather than pretending the
    // call was free. The job's measured fields stay null when usage was absent.
    commit(id, usage ? Math.ceil(usage.costUsd * 1_000_000) : null);
  };

  try {
    const result = await chat(messages, {
      model: input.model as 'deepseek-flash' | 'deepseek-v4-pro',
      thinking: input.thinking,
      ...(input.thinking === 'enabled' && input.effort ? { effort: input.effort } : {}),
      maxTokens: requestedMaxTokens,
      temperature: input.thinking === 'disabled' ? 0.2 : undefined,
      userId: `hive-chat-${input.jobId}-${input.agentId}`,
      signal: input.signal,
      onHttpAttemptStart,
      onHttpAttemptEnd,
    });
    if (!totals) addUsage(result.usage);
    return {
      text: result.content,
      usage: totals ?? {
        costUsd: result.usage.costUsd,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
      },
    };
  } catch (error) {
    if (reservationId) {
      const id = reservationId;
      reservationId = null;
      release(id);
    }
    throw error;
  }
}

/** The worker calls this to classify provider failures without leaking prose. */
export function chatFailure(error: unknown): { code: string; message: string; retryable: boolean; usage: ChatUsage | null } {
  if (error instanceof LlmError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      usage: null,
    };
  }
  if (error instanceof Error) {
    const code = /^E_[A-Z0-9_]+/.exec(error.message)?.[0] ?? 'E_CHAT_GENERATION_FAILED';
    return { code, message: error.message, retryable: false, usage: null };
  }
  return { code: 'E_CHAT_GENERATION_FAILED', message: String(error), retryable: false, usage: null };
}

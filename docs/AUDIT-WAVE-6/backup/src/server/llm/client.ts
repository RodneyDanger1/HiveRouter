/**
 * Filename: src/server/llm/client.ts
 * Dependencies: global fetch, zod, ../config.js, ../security/keys.js, ../security/redact.js
 * Run: imported by server modules; tests in test/unit/llm.client.test.ts
 *
 * Direct DeepSeek Chat Completions client. No OpenAI SDK.
 * The key is held only in the client instance and is never included in errors.
 */

import { z } from 'zod';
import { config } from '../config.js';
import { requireKey } from '../security/keys.js';
import { redactString } from '../security/redact.js';
import type { Effort, ModelId, ThinkingMode, UsageRecord } from '../../shared/types.js';

export type FinishReason =
  | 'stop'
  | 'length'
  | 'content_filter'
  | 'tool_calls'
  | 'insufficient_system_resource'
  | 'aborted'
  | 'unknown';

export type LlmErrorCode =
  | 'E_KEY_NOT_CONFIGURED'
  | 'E_KEY_INVALID'
  | 'E_BALANCE_LOW'
  | 'E_CANCELLED'
  | 'E_LLM_BAD_REQUEST'
  | 'E_LLM_FORBIDDEN'
  | 'E_LLM_NOT_FOUND'
  | 'E_LLM_INVALID_PARAMETERS'
  | 'E_LLM_RATE_LIMIT'
  | 'E_LLM_PROVIDER_ERROR'
  | 'E_LLM_HTTP_ERROR'
  | 'E_LLM_TIMEOUT'
  | 'E_LLM_NETWORK'
  | 'E_LLM_ABORTED'
  | 'E_LLM_INVALID_RESPONSE'
  | 'E_LLM_USAGE_MISSING'
  | 'E_LLM_EMPTY_CONTENT'
  | 'E_LLM_EMPTY_JSON'
  | 'E_LLM_JSON_INVALID'
  | 'E_LLM_SCHEMA_INVALID'
  | 'E_LLM_TRUNCATED'
  | 'E_LLM_CONTENT_FILTER'
  | 'E_LLM_INSUFFICIENT_RESOURCE'
  | 'E_LLM_TOOL_CALLS'
  | 'E_LLM_UNKNOWN_FINISH'
  | 'E_LLM_CONFIG'
  // Callers may construct LlmError with a shared refusal code (for example
  // E_UNSUPPORTED_AGENT in the pipeline). The client itself only emits E_LLM_*.
  | (string & {});

export interface LlmErrorPayload {
  code: LlmErrorCode;
  message: string;
  status: number | null;
  retryable: boolean;
}

export class LlmError extends Error implements LlmErrorPayload {
  readonly code: LlmErrorCode;
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(
    code: LlmErrorCode,
    message: string,
    status: number | null = null,
    retryable = false,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'LlmError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }

  toJSON(): LlmErrorPayload {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      retryable: this.retryable,
    };
  }
}

/** Backwards-compatible name used by the first scaffold. */
export { LlmError as DeepSeekError };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type LlmMessage = ChatMessage;

export interface ChatOptions {
  model?: ModelId;
  thinking?: ThinkingMode;
  effort?: Effort;
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
  userId?: string;
  signal?: AbortSignal;
  onResult?: (result: ChatResult) => void;
  /** Called before each provider attempt in structured(); return a budget-fitted max_tokens. */
  onAttemptStart?: (attempt: number) => number | void;
  /** Called once per structured attempt after usage is known or the attempt fails. */
  onAttemptEnd?: (attempt: number, usage: UsageRecord | null, error: LlmError | null) => void;
  /** Called immediately before each actual HTTP request, including internal retries; requestChars is the serialized request body size. */
  onHttpAttemptStart?: (attempt: number, requestChars?: number) => void;
  /** Called after each actual HTTP request settles or fails; usage is null if unknown. */
  onHttpAttemptEnd?: (attempt: number, usage: UsageRecord | null) => void;
  baseUrl?: string;
  maxAttempts?: number;
  maxJsonRepairs?: number;
  timeoutMs?: number;
}

export interface ChatRequest {
  model?: ModelId;
  messages: ChatMessage[];
  thinking?: ThinkingMode;
  reasoningEffort?: Effort;
  temperature?: number;
  maxTokens?: number;
  /** DeepSeek top-level cache/scheduling isolation id. */
  userId?: string;
  /** Force response_format:{type:'json_object'} and reject blank JSON. */
  json?: boolean;
  signal?: AbortSignal;
  /** Per-request override; defaults to config.limits.requestTimeoutMs. */
  timeoutMs?: number;
  onResult?: (result: ChatResult) => void;
  onAttemptStart?: (attempt: number) => number | void;
  onAttemptEnd?: (attempt: number, usage: UsageRecord | null, error: LlmError | null) => void;
  /** Called immediately before each actual HTTP request, including internal retries; requestChars is the serialized request body size. */
  onHttpAttemptStart?: (attempt: number, requestChars?: number) => void;
  /** Called after each actual HTTP request settles or fails; usage is null if unknown. */
  onHttpAttemptEnd?: (attempt: number, usage: UsageRecord | null) => void;
}

export interface ChatResult {
  id: string;
  model: string;
  content: string;
  reasoningContent: string | null;
  finishReason: FinishReason;
  usage: UsageRecord;
  systemFingerprint?: string;
}

export interface StructuredChatResult<T> extends ChatResult {
  data: T;
  jsonRepairAttempts: number;
}

export interface TokenUsageInput {
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
}

export interface DeepSeekClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  maxAttempts?: number;
  requestTimeoutMs?: number;
  maxJsonRepairs?: number;
}

const DEFAULT_MAX_TOKENS = 8192;
const MAX_ERROR_MESSAGE_CHARS = 600;
const MAX_REPAIR_CONTENT_CHARS = 4000;
const JSON_REPAIRABLE: ReadonlySet<LlmErrorCode> = new Set([
  'E_LLM_EMPTY_JSON',
  'E_LLM_EMPTY_CONTENT',
  'E_LLM_JSON_INVALID',
  'E_LLM_SCHEMA_INVALID',
]);

const DeepSeekModelSchema = z
  .object({
    id: z.string(),
    object: z.literal('model'),
    owned_by: z.string(),
    name: z.string().optional(),
    context_window: z.number().int().positive().optional(),
    max_output_tokens: z.number().int().positive().optional(),
  })
  .passthrough();

const ModelsResponseSchema = z
  .object({
    object: z.literal('list'),
    data: z.array(DeepSeekModelSchema).min(1),
  })
  .passthrough();

const MoneySchema = z.union([z.string(), z.number()]).transform((value) => String(value));

const DeepSeekBalanceInfoSchema = z
  .object({
    currency: z.string(),
    total_balance: MoneySchema,
    granted_balance: MoneySchema,
    topped_up_balance: MoneySchema,
  })
  .passthrough();

const DeepSeekBalanceSchema = z
  .object({
    is_available: z.boolean(),
    balance_infos: z.array(DeepSeekBalanceInfoSchema),
  })
  .passthrough();

const UsageSchema = z
  .object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative().optional(),
    prompt_tokens_details: z
      .object({
        prompt_cache_hit_tokens: z.number().int().nonnegative().optional(),
        prompt_cache_miss_tokens: z.number().int().nonnegative().optional(),
        cached_tokens: z.number().int().nonnegative().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    completion_tokens_details: z
      .object({
        reasoning_tokens: z.number().int().nonnegative().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    prompt_cache_hit_tokens: z.number().int().nonnegative().optional(),
    prompt_cache_miss_tokens: z.number().int().nonnegative().optional(),
    reasoning_tokens: z.number().int().nonnegative().optional(),
  })
  .passthrough();

const ChatChoiceSchema = z
  .object({
    index: z.number().int().optional(),
    finish_reason: z.string().nullable().optional(),
    message: z
      .object({
        role: z.literal('assistant'),
        content: z.string().nullable().optional(),
        reasoning_content: z.string().nullable().optional(),
        tool_calls: z.array(z.unknown()).optional(),
      })
      .passthrough(),
  })
  .passthrough();

const ChatCompletionSchema = z
  .object({
    id: z.string(),
    model: z.string(),
    choices: z.array(ChatChoiceSchema).min(1),
    usage: UsageSchema.nullable().optional(),
    system_fingerprint: z.string().nullable().optional(),
  })
  .passthrough();

export type DeepSeekModelInfo = z.infer<typeof DeepSeekModelSchema>;
export type DeepSeekBalanceInfo = z.infer<typeof DeepSeekBalanceInfoSchema>;
export type DeepSeekBalance = z.infer<typeof DeepSeekBalanceSchema>;

export function isPeakUtc(at: Date): boolean {
  if (Number.isNaN(at.getTime())) return false;
  const day = at.getUTCDay();
  if (day === 0 || day === 6) return false;
  const hour = at.getUTCHours();
  return (hour >= 1 && hour < 4) || (hour >= 6 && hour < 10);
}

export function computeCostUsd(model: ModelId, usage: TokenUsageInput, at: Date): number {
  const prices = config.pricing[model];
  if (!prices) {
    throw new LlmError('E_LLM_CONFIG', `No pricing table exists for model "${model}".`);
  }
  if (Number.isNaN(at.getTime())) {
    throw new LlmError('E_LLM_CONFIG', 'Cannot compute cost for an invalid date.');
  }
  const peak = isPeakUtc(at);
  const cacheHitPrice = peak ? prices.cacheHitPeak : prices.cacheHitOffPeak;
  const cacheMissPrice = peak ? prices.cacheMissPeak : prices.cacheMissOffPeak;
  const outputPrice = peak ? prices.outputPeak : prices.outputOffPeak;
  return (
    (usage.cacheHitTokens * cacheHitPrice +
      usage.cacheMissTokens * cacheMissPrice +
      usage.completionTokens * outputPrice) /
    1_000_000
  );
}

function normalizeFinishReason(raw: string | null | undefined): FinishReason {
  switch (raw) {
    case 'stop':
    case 'length':
    case 'content_filter':
    case 'tool_calls':
    case 'insufficient_system_resource':
    case 'aborted':
      return raw;
    default:
      return 'unknown';
  }
}

function abortedError(): LlmError {
  return new LlmError('E_LLM_ABORTED', 'The DeepSeek request was aborted by the caller.', null, false);
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortedError());
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(abortedError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, Math.max(0, ms));
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function parseRetryAfter(headers: Headers): number | null {
  const raw = headers.get('retry-after');
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(60_000, Math.floor(seconds * 1000));
  const dateMs = Date.parse(raw);
  if (Number.isFinite(dateMs)) return Math.min(60_000, Math.max(0, dateMs - Date.now()));
  return null;
}

function issueSummary(error: z.ZodError): string {
  return error.issues
    .slice(0, 4)
    .map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : '<root>'}: ${issue.message}`)
    .join('; ');
}

function withJsonRepair(messages: ChatMessage[], previous: string | null, reason: string): ChatMessage[] {
  const next = [...messages];
  if (previous && previous.trim().length > 0) {
    next.push({ role: 'assistant', content: previous.slice(0, MAX_REPAIR_CONTENT_CHARS) });
  }
  next.push({
    role: 'user',
    content:
      `Your previous response was not valid JSON (${reason}). ` +
      'Return exactly one JSON object and nothing else. Do not use markdown fences or commentary.',
  });
  return next;
}

function mapHttpError(status: number): { code: LlmErrorCode; retryable: boolean } {
  if (status === 400) return { code: 'E_LLM_BAD_REQUEST', retryable: false };
  if (status === 401) return { code: 'E_KEY_INVALID', retryable: false };
  if (status === 402) return { code: 'E_BALANCE_LOW', retryable: false };
  if (status === 403) return { code: 'E_LLM_FORBIDDEN', retryable: false };
  if (status === 404) return { code: 'E_LLM_NOT_FOUND', retryable: false };
  if (status === 408) return { code: 'E_LLM_TIMEOUT', retryable: true };
  if (status === 422) return { code: 'E_LLM_INVALID_PARAMETERS', retryable: false };
  if (status === 429) return { code: 'E_LLM_RATE_LIMIT', retryable: true };
  if (status >= 500 && status <= 599) return { code: 'E_LLM_PROVIDER_ERROR', retryable: true };
  return { code: 'E_LLM_HTTP_ERROR', retryable: false };
}

function requireApiKey(): string {
  try {
    return requireKey();
  } catch (error) {
    throw new LlmError('E_KEY_NOT_CONFIGURED', 'No DeepSeek API key is configured.', null, false, {
      cause: error,
    });
  }
}

export class DeepSeekClient {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetchImpl: typeof fetch;
  readonly #now: () => Date;
  readonly #sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  readonly #maxAttempts: number;
  readonly #requestTimeoutMs: number;
  readonly #maxJsonRepairs: number;

  constructor(options: DeepSeekClientOptions) {
    const key = options.apiKey?.trim();
    if (!key) {
      throw new LlmError('E_KEY_NOT_CONFIGURED', 'No DeepSeek API key was provided.');
    }
    const baseUrl = (options.baseUrl ?? config.baseUrl).replace(/\/+$/, '');
    try {
      const parsed = new URL(baseUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('unsupported protocol');
      }
    } catch {
      throw new LlmError('E_LLM_CONFIG', 'DEEPSEEK_BASE_URL must be a valid http(s) URL.');
    }
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new LlmError('E_LLM_CONFIG', 'No fetch implementation is available.');
    }
    const maxAttempts = options.maxAttempts ?? 3;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) {
      throw new LlmError('E_LLM_CONFIG', 'maxAttempts must be an integer between 1 and 5.');
    }
    const timeoutMs = options.requestTimeoutMs ?? config.limits.requestTimeoutMs;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
      throw new LlmError('E_LLM_CONFIG', 'requestTimeoutMs must be a positive integer.');
    }
    const maxJsonRepairs = options.maxJsonRepairs ?? 2;
    if (!Number.isInteger(maxJsonRepairs) || maxJsonRepairs < 0 || maxJsonRepairs > 5) {
      throw new LlmError('E_LLM_CONFIG', 'maxJsonRepairs must be an integer between 0 and 5.');
    }
    this.#apiKey = key;
    this.#baseUrl = baseUrl;
    this.#fetchImpl = fetchImpl;
    this.#now = options.now ?? (() => new Date());
    this.#sleep = options.sleep ?? defaultSleep;
    this.#maxAttempts = maxAttempts;
    this.#requestTimeoutMs = timeoutMs;
    this.#maxJsonRepairs = maxJsonRepairs;
  }

  async chat(request: ChatRequest): Promise<ChatResult> {
    const startedAt = this.#now();
    const body = this.#buildBody(request);
    const timeoutMs = request.timeoutMs ?? this.#requestTimeoutMs;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
      throw new LlmError('E_LLM_CONFIG', 'timeoutMs must be a positive integer.');
    }

    const { response, attempt } = await this.#requestWithRetry(
      '/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      request.signal,
      timeoutMs,
      {
        onHttpAttemptStart: request.onHttpAttemptStart,
        onHttpAttemptEnd: request.onHttpAttemptEnd,
      },
    );

    try {
      const raw = await this.#parseJson(response);
      const parsed = ChatCompletionSchema.safeParse(raw);
      if (!parsed.success) {
        throw new LlmError(
          'E_LLM_INVALID_RESPONSE',
          `DeepSeek response did not match the Chat Completions schema: ${issueSummary(parsed.error)}`,
          response.status,
          false,
        );
      }

      const completion = parsed.data;
      const choice = completion.choices[0];
      if (!choice) {
        throw new LlmError('E_LLM_INVALID_RESPONSE', 'DeepSeek returned no choices.', response.status, false);
      }
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        throw new LlmError(
          'E_LLM_TOOL_CALLS',
          'DeepSeek returned tool calls, but this client does not execute tools.',
          response.status,
          false,
        );
      }

      const finishReason = normalizeFinishReason(choice.finish_reason);
      if (finishReason === 'length') {
        throw new LlmError(
          'E_LLM_TRUNCATED',
          'DeepSeek stopped at finish_reason "length"; the output is truncated and must not be accepted.',
          response.status,
          false,
        );
      }
      if (finishReason === 'content_filter') {
        throw new LlmError(
          'E_LLM_CONTENT_FILTER',
          'DeepSeek stopped at finish_reason "content_filter".',
          response.status,
          false,
        );
      }
      if (finishReason === 'insufficient_system_resource') {
        throw new LlmError(
          'E_LLM_INSUFFICIENT_RESOURCE',
          'DeepSeek stopped at finish_reason "insufficient_system_resource"; retry is allowed.',
          response.status,
          true,
        );
      }
      if (finishReason === 'aborted') {
        if (request.signal?.aborted) throw abortedError();
        throw new LlmError(
          'E_LLM_ABORTED',
          'DeepSeek stopped at finish_reason "aborted"; retry is allowed.',
          response.status,
          true,
        );
      }
      if (finishReason === 'tool_calls') {
        throw new LlmError(
          'E_LLM_TOOL_CALLS',
          'DeepSeek stopped at finish_reason "tool_calls", but this client does not execute tools.',
          response.status,
          false,
        );
      }
      if (finishReason === 'unknown') {
        throw new LlmError(
          'E_LLM_UNKNOWN_FINISH',
          `DeepSeek returned an unrecognized finish_reason: ${String(choice.finish_reason)}.`,
          response.status,
          false,
        );
      }

      const content = choice.message.content ?? '';
      if (content.trim().length === 0) {
        throw new LlmError(
          request.json ? 'E_LLM_EMPTY_JSON' : 'E_LLM_EMPTY_CONTENT',
          request.json ? 'DeepSeek returned blank JSON content.' : 'DeepSeek returned empty content.',
          response.status,
          false,
        );
      }

      const usage = this.#usageFrom(completion.usage, request.model ?? config.model, completion.model, startedAt);
      const reasoningContent =
        typeof choice.message.reasoning_content === 'string' && choice.message.reasoning_content.trim().length > 0
          ? choice.message.reasoning_content
          : null;

      const result: ChatResult = {
        id: completion.id,
        model: completion.model,
        content,
        reasoningContent,
        finishReason,
        usage,
        systemFingerprint: completion.system_fingerprint ?? undefined,
      };
      request.onHttpAttemptEnd?.(attempt, usage);
      request.onResult?.(result);
      return result;
    } catch (error) {
      request.onHttpAttemptEnd?.(attempt, null);
      throw error;
    }
  }

  async structured<T>(schema: z.ZodType<T>, request: ChatRequest): Promise<StructuredChatResult<T>> {
    let messages: ChatMessage[] = [...request.messages];
    let lastCode: LlmErrorCode = 'E_LLM_JSON_INVALID';
    let lastMessage = 'DeepSeek did not return valid JSON.';

    for (let attempt = 0; attempt <= this.#maxJsonRepairs; attempt += 1) {
      const attemptMaxTokens = request.onAttemptStart?.(attempt);
      let result: ChatResult;
      try {
        result = await this.chat({
          ...request,
          json: true,
          messages,
          maxTokens: attemptMaxTokens ?? request.maxTokens,
        });
      } catch (error) {
        request.onAttemptEnd?.(
          attempt,
          null,
          error instanceof LlmError ? error : null,
        );
        if (!(error instanceof LlmError) || !JSON_REPAIRABLE.has(error.code)) throw error;
        lastCode = error.code;
        lastMessage = error.message;
        if (attempt >= this.#maxJsonRepairs) break;
        messages = withJsonRepair(messages, null, error.code);
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.content) as unknown;
      } catch {
        request.onAttemptEnd?.(attempt, result.usage, null);
        lastCode = 'E_LLM_JSON_INVALID';
        lastMessage = 'DeepSeek returned content that is not parseable JSON.';
        if (attempt >= this.#maxJsonRepairs) break;
        messages = withJsonRepair(messages, result.content, 'parse error');
        continue;
      }

      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        request.onAttemptEnd?.(attempt, result.usage, null);
        lastCode = 'E_LLM_SCHEMA_INVALID';
        lastMessage = `DeepSeek JSON did not match the required schema: ${issueSummary(validated.error)}`;
        if (attempt >= this.#maxJsonRepairs) break;
        messages = withJsonRepair(messages, result.content, issueSummary(validated.error));
        continue;
      }

      request.onAttemptEnd?.(attempt, result.usage, null);
      return {
        ...result,
        data: validated.data,
        jsonRepairAttempts: attempt,
      };
    }

    throw new LlmError(
      lastCode,
      `${lastMessage} (after ${this.#maxJsonRepairs} JSON repair attempt${this.#maxJsonRepairs === 1 ? '' : 's'})`,
      200,
      false,
    );
  }

  async models(signal?: AbortSignal): Promise<DeepSeekModelInfo[]> {
    const { response } = await this.#requestWithRetry('/models', { method: 'GET' }, signal, this.#requestTimeoutMs);
    const raw = await this.#parseJson(response);
    const parsed = ModelsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new LlmError(
        'E_LLM_INVALID_RESPONSE',
        `DeepSeek /models response did not match the expected schema: ${issueSummary(parsed.error)}`,
        response.status,
        false,
      );
    }
    return parsed.data.data;
  }

  async balance(signal?: AbortSignal): Promise<DeepSeekBalance> {
    const { response } = await this.#requestWithRetry('/user/balance', { method: 'GET' }, signal, this.#requestTimeoutMs);
    const raw = await this.#parseJson(response);
    const parsed = DeepSeekBalanceSchema.safeParse(raw);
    if (!parsed.success) {
      throw new LlmError(
        'E_LLM_INVALID_RESPONSE',
        `DeepSeek /user/balance response did not match the expected schema: ${issueSummary(parsed.error)}`,
        response.status,
        false,
      );
    }
    return parsed.data;
  }

  #buildBody(request: ChatRequest): Record<string, unknown> {
    const model = request.model ?? config.model;
    if (!config.pricing[model]) {
      throw new LlmError('E_LLM_CONFIG', `Unsupported model "${String(model)}".`);
    }
    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      throw new LlmError('E_LLM_CONFIG', 'messages must be a non-empty array.');
    }
    for (const message of request.messages) {
      if (
        !message ||
        (message.role !== 'system' && message.role !== 'user' && message.role !== 'assistant') ||
        typeof message.content !== 'string'
      ) {
        throw new LlmError('E_LLM_CONFIG', 'Every message must have a valid role and string content.');
      }
    }

    const thinking: ThinkingMode = request.thinking ?? 'disabled';
    const maxTokens = request.maxTokens ?? DEFAULT_MAX_TOKENS;
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > config.limits.maxOutputTokens) {
      throw new LlmError(
        'E_LLM_CONFIG',
        `maxTokens must be an integer between 1 and ${config.limits.maxOutputTokens}.`,
      );
    }

    const body: Record<string, unknown> = {
      model,
      messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
      thinking: { type: thinking },
      max_tokens: maxTokens,
    };

    if (thinking === 'enabled' && request.reasoningEffort) {
      body.reasoning_effort = request.reasoningEffort;
    }
    if (thinking === 'disabled' && request.temperature !== undefined) {
      if (!Number.isFinite(request.temperature) || request.temperature < 0 || request.temperature > 2) {
        throw new LlmError('E_LLM_CONFIG', 'temperature must be a finite number between 0 and 2.');
      }
      // DeepSeek ignores temperature in thinking mode; never send it there.
      body.temperature = request.temperature;
    }
    if (request.userId !== undefined) {
      if (!/^[A-Za-z0-9_-]{1,512}$/.test(request.userId)) {
        throw new LlmError('E_LLM_CONFIG', 'userId must be 1-512 ASCII letters, digits, underscores, or hyphens.');
      }
      body.user_id = request.userId;
    }
    if (request.json) {
      body.response_format = { type: 'json_object' };
    }
    return body;
  }

  async #requestWithRetry(
    path: string,
    init: { method: string; headers?: Record<string, string>; body?: string },
    signal: AbortSignal | undefined,
    timeoutMs: number,
    hooks?: {
      onHttpAttemptStart?: (attempt: number, requestChars?: number) => void;
      onHttpAttemptEnd?: (attempt: number, usage: UsageRecord | null) => void;
    },
  ): Promise<{ response: Response; attempt: number }> {
    const url = `${this.#baseUrl}${path}`;
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${this.#apiKey}`);
    if (init.body !== undefined) headers.set('Content-Type', 'application/json');

    let lastError: LlmError | null = null;
    for (let attempt = 1; attempt <= this.#maxAttempts; attempt += 1) {
      if (signal?.aborted) throw abortedError();
      hooks?.onHttpAttemptStart?.(attempt, init.body?.length);
      let ended = false;
      try {
        const response = await this.#fetchWithTimeout(url, { ...init, headers }, signal, timeoutMs);
        if (response.ok) return { response, attempt };

        const retryAfterMs = parseRetryAfter(response.headers);
        const httpError = await this.#httpError(response);
        lastError = httpError;
        hooks?.onHttpAttemptEnd?.(attempt, null);
        ended = true;
        if (httpError.retryable && attempt < this.#maxAttempts) {
          await this.#sleep(this.#backoffMs(attempt, retryAfterMs), signal);
          continue;
        }
        throw httpError;
      } catch (error) {
        if (!ended) hooks?.onHttpAttemptEnd?.(attempt, null);
        if (error instanceof LlmError) throw error;
        const transportError = this.#transportError(error, signal);
        lastError = transportError;
        if (transportError.retryable && attempt < this.#maxAttempts) {
          await this.#sleep(this.#backoffMs(attempt), signal);
          continue;
        }
        throw transportError;
      }
    }
    throw lastError ?? new LlmError('E_LLM_NETWORK', 'DeepSeek request failed after retries.', null, true);
  }

  async #fetchWithTimeout(
    url: string,
    init: RequestInit,
    signal: AbortSignal | undefined,
    timeoutMs: number,
  ): Promise<Response> {
    if (signal?.aborted) throw abortedError();
    const controller = new AbortController();
    const onCallerAbort = (): void => controller.abort(signal?.reason);
    signal?.addEventListener('abort', onCallerAbort, { once: true });

    const timeoutError = new Error(`DeepSeek request timed out after ${timeoutMs}ms.`);
    timeoutError.name = 'TimeoutError';
    const timer = setTimeout(() => controller.abort(timeoutError), timeoutMs);

    try {
      return await this.#fetchImpl(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (signal?.aborted) throw abortedError();
      if (controller.signal.aborted && controller.signal.reason instanceof Error) {
        if (controller.signal.reason.name === 'TimeoutError') throw controller.signal.reason;
      }
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onCallerAbort);
    }
  }

  #transportError(error: unknown, signal: AbortSignal | undefined): LlmError {
    if (signal?.aborted) return abortedError();
    if (error instanceof Error && error.name === 'TimeoutError') {
      return new LlmError('E_LLM_TIMEOUT', error.message, null, true, { cause: error });
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return abortedError();
    }
    const detail = redactString(error instanceof Error ? error.message : String(error)).slice(0, 300);
    return new LlmError('E_LLM_NETWORK', `DeepSeek network error: ${detail}`, null, true, { cause: error });
  }

  #backoffMs(attempt: number, retryAfterMs?: number | null): number {
    if (retryAfterMs !== undefined && retryAfterMs !== null) return retryAfterMs;
    return Math.min(60_000, 500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 100));
  }

  async #httpError(response: Response): Promise<LlmError> {
    const text = await response.text().catch(() => '');
    let providerMessage = '';
    try {
      const body = JSON.parse(text) as { error?: { message?: unknown }; message?: unknown };
      if (body.error && typeof body.error.message === 'string') providerMessage = body.error.message;
      else if (typeof body.message === 'string') providerMessage = body.message;
    } catch {
      providerMessage = text;
    }
    const safeMessage =
      redactString(providerMessage).trim().slice(0, MAX_ERROR_MESSAGE_CHARS) ||
      `DeepSeek returned HTTP ${response.status}.`;
    const mapped = mapHttpError(response.status);
    return new LlmError(
      mapped.code,
      `DeepSeek HTTP ${response.status}: ${safeMessage}`,
      response.status,
      mapped.retryable,
    );
  }

  async #parseJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text.trim()) {
      throw new LlmError(
        'E_LLM_INVALID_RESPONSE',
        `DeepSeek returned an empty HTTP body (status ${response.status}).`,
        response.status,
        false,
      );
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new LlmError(
        'E_LLM_INVALID_RESPONSE',
        `DeepSeek returned a non-JSON HTTP body (status ${response.status}).`,
        response.status,
        false,
      );
    }
  }

  #usageFrom(
    raw: z.infer<typeof UsageSchema> | null | undefined,
    requestedModel: ModelId,
    responseModel: string,
    at: Date,
  ): UsageRecord {
    if (!raw) {
      throw new LlmError(
        'E_LLM_USAGE_MISSING',
        'DeepSeek response is missing usage; cost cannot be computed from provider data.',
        200,
        false,
      );
    }
    const promptTokens = raw.prompt_tokens;
    const completionTokens = raw.completion_tokens;
    const details = raw.prompt_tokens_details ?? undefined;
    const completionDetails = raw.completion_tokens_details ?? undefined;

    const rawHit = details?.prompt_cache_hit_tokens ?? raw.prompt_cache_hit_tokens ?? 0;
    const rawMiss = details?.prompt_cache_miss_tokens ?? raw.prompt_cache_miss_tokens;
    const cacheHitTokens = Math.max(0, Math.min(promptTokens, rawHit));
    let cacheMissTokens = rawMiss ?? Math.max(0, promptTokens - cacheHitTokens);
    if (cacheHitTokens + cacheMissTokens !== promptTokens) {
      cacheMissTokens = Math.max(0, promptTokens - cacheHitTokens);
    }
    const reasoningTokens = completionDetails?.reasoning_tokens ?? raw.reasoning_tokens ?? 0;

    const costUsd = computeCostUsd(
      requestedModel,
      { promptTokens, completionTokens, cacheHitTokens, cacheMissTokens },
      at,
    );

    return {
      promptTokens,
      completionTokens,
      cacheHitTokens,
      cacheMissTokens,
      reasoningTokens,
      costUsd,
      source: 'provider',
      model: responseModel,
    };
  }
}

export function createDeepSeekClient(options: DeepSeekClientOptions): DeepSeekClient {
  return new DeepSeekClient(options);
}

/** Compatibility wrapper: create a client from the configured key and call it. */
export async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
  const client = new DeepSeekClient({
    apiKey: requireApiKey(),
    baseUrl: options.baseUrl,
    maxAttempts: options.maxAttempts,
    maxJsonRepairs: options.maxJsonRepairs,
    requestTimeoutMs: options.timeoutMs,
  });
  return client.chat({
    model: options.model,
    messages,
    thinking: options.thinking,
    reasoningEffort: options.effort,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    userId: options.userId,
    json: options.json,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    onResult: options.onResult,
    onHttpAttemptStart: options.onHttpAttemptStart,
    onHttpAttemptEnd: options.onHttpAttemptEnd,
  });
}

/** Compatibility wrapper: strict JSON parse + Zod validation, with two repair attempts. */
export async function chatJson<T>(
  schema: z.ZodType<T>,
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<T> {
  const client = new DeepSeekClient({
    apiKey: requireApiKey(),
    baseUrl: options.baseUrl,
    maxAttempts: options.maxAttempts,
    maxJsonRepairs: options.maxJsonRepairs,
    requestTimeoutMs: options.timeoutMs,
  });
  const result = await client.structured(schema, {
    model: options.model,
    messages,
    thinking: options.thinking,
    reasoningEffort: options.effort,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    userId: options.userId,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    onResult: options.onResult,
    onAttemptStart: options.onAttemptStart,
    onAttemptEnd: options.onAttemptEnd,
    onHttpAttemptStart: options.onHttpAttemptStart,
    onHttpAttemptEnd: options.onHttpAttemptEnd,
  });
  return result.data;
}

export async function models(signal?: AbortSignal): Promise<DeepSeekModelInfo[]> {
  return new DeepSeekClient({ apiKey: requireApiKey() }).models(signal);
}

export async function balance(signal?: AbortSignal): Promise<DeepSeekBalance> {
  return new DeepSeekClient({ apiKey: requireApiKey() }).balance(signal);
}

/** Compatibility utility; strict structured calls do not use fence stripping. */
export function stripFences(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/m.exec(trimmed);
  return fence ? fence[1].trim() : trimmed;
}

/** Compatibility utility; strict structured calls use JSON.parse, not this loose parser. */
export function parseJsonLoose(text: string): unknown {
  const stripped = stripFences(text);
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(stripped.slice(start, end + 1));
    throw new LlmError('E_LLM_JSON_INVALID', 'The provider response did not contain JSON.');
  }
}

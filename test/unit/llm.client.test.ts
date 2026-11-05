/**
 * Filename: test/unit/llm.client.test.ts
 * Dependencies: node:http, vitest, zod, src/server/llm/client.ts
 * Run: npm.cmd test -- --run test/unit/llm.client.test.ts
 *
 * Local mock HTTP server only; no paid API call and no real key.
 */

import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  DeepSeekClient,
  computeCostUsd,
  type ChatRequest,
  type DeepSeekClientOptions,
} from '../../src/server/llm/client.js';

interface MockResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
  delayMs?: number;
}

interface RecordedRequest {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: unknown;
}

const OFF_PEAK = new Date('2026-11-03T12:00:00.000Z');
const PEAK = new Date('2026-11-03T02:00:00.000Z');

const modelsBody = {
  object: 'list',
  data: [
    {
      id: 'deepseek-flash',
      object: 'model',
      owned_by: 'deepseek',
      name: 'DeepSeek-V4.1-Flash',
      context_window: 1_048_576,
      max_output_tokens: 393_216,
    },
  ],
};

const balanceBody = {
  is_available: true,
  balance_infos: [
    {
      currency: 'USD',
      total_balance: '6.82',
      granted_balance: '0.00',
      topped_up_balance: '6.82',
    },
  ],
};

const defaultUsage = {
  prompt_tokens: 1000,
  completion_tokens: 500,
  total_tokens: 1500,
  prompt_tokens_details: {
    prompt_cache_hit_tokens: 400,
    prompt_cache_miss_tokens: 600,
  },
  completion_tokens_details: {
    reasoning_tokens: 100,
  },
};

interface CompletionOptions {
  content?: string | null;
  finish?: string;
  reasoning?: string | null;
  usage?: unknown;
  model?: string;
}

function completionBody(options: CompletionOptions = {}): unknown {
  return {
    id: 'chatcmpl_test',
    object: 'chat.completion',
    created: 1_700_000_000,
    model: options.model ?? 'deepseek-flash',
    choices: [
      {
        index: 0,
        finish_reason: options.finish ?? 'stop',
        message: {
          role: 'assistant',
          content: options.content ?? 'hello',
          reasoning_content: options.reasoning === undefined ? 'thinking' : options.reasoning,
        },
      },
    ],
    usage: options.usage === undefined ? defaultUsage : options.usage,
    system_fingerprint: 'fp_test',
  };
}

let server: Server;
let baseUrl = '';
let requests: RecordedRequest[] = [];
let queue: MockResponse[] = [];
let nextNow = OFF_PEAK;

async function respond(res: import('node:http').ServerResponse, response: MockResponse): Promise<void> {
  if (response.delayMs && response.delayMs > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, response.delayMs));
  }
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(response.status, {
    'Content-Type': 'application/json',
    ...(response.headers ?? {}),
  });
  res.end(JSON.stringify(response.body));
}

async function handle(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  chunks: Buffer[],
): Promise<void> {
  const raw = Buffer.concat(chunks).toString('utf8');
  let body: unknown = raw;
  try {
    body = raw.length > 0 ? (JSON.parse(raw) as unknown) : null;
  } catch {
    body = raw;
  }
  requests.push({
    method: req.method ?? '',
    url: req.url ?? '',
    headers: req.headers,
    body,
  });

  if (req.url === '/models') {
    await respond(res, { status: 200, body: modelsBody });
    return;
  }
  if (req.url === '/user/balance') {
    await respond(res, { status: 200, body: balanceBody });
    return;
  }
  if (req.url === '/chat/completions') {
    const next = queue.shift() ?? {
      status: 500,
      body: { error: { message: 'mock response queue is empty' } },
    };
    await respond(res, next);
    return;
  }
  await respond(res, { status: 404, body: { error: { message: 'not found' } } });
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      void handle(req, res, chunks).catch((error: unknown) => {
        if (!res.writableEnded && !res.destroyed) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: String(error) } }));
        }
      });
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  requests = [];
  queue = [];
  nextNow = OFF_PEAK;
});

function makeClient(overrides: Partial<DeepSeekClientOptions> = {}): DeepSeekClient {
  return new DeepSeekClient({
    apiKey: 'test-key',
    baseUrl,
    now: () => nextNow,
    sleep: async () => undefined,
    maxAttempts: 3,
    requestTimeoutMs: 1000,
    ...overrides,
  });
}

function chatRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    messages: [{ role: 'user', content: 'hello' }],
    thinking: 'disabled',
    temperature: 0.2,
    maxTokens: 128,
    userId: 'hive-test',
    ...overrides,
  };
}

describe('DeepSeekClient', () => {
  it('sends the required body and parses usage/cost', async () => {
    queue.push({ status: 200, body: completionBody() });

    const result = await makeClient().chat(chatRequest());

    expect(result.content).toBe('hello');
    expect(result.reasoningContent).toBe('thinking');
    expect(result.finishReason).toBe('stop');
    expect(result.usage.promptTokens).toBe(1000);
    expect(result.usage.completionTokens).toBe(500);
    expect(result.usage.cacheHitTokens).toBe(400);
    expect(result.usage.cacheMissTokens).toBe(600);
    expect(result.usage.reasoningTokens).toBe(100);
    expect(result.usage.source).toBe('provider');
    expect(result.usage.costUsd).toBeCloseTo(0.0003912, 10);

    const body = requests[0]?.body as Record<string, unknown>;
    expect(body.model).toBe('deepseek-flash');
    expect(body.thinking).toEqual({ type: 'disabled' });
    expect(body.max_tokens).toBe(128);
    expect(body.temperature).toBe(0.2);
    expect(body.user_id).toBe('hive-test');
    expect(body.response_format).toBeUndefined();
    expect(body.reasoning_effort).toBeUndefined();
    expect(requests[0]?.headers.authorization).toBe('Bearer test-key');
  });

  it('omits temperature in thinking mode and requests JSON', async () => {
    nextNow = PEAK;
    queue.push({ status: 200, body: completionBody({ content: '{"ok":true}' }) });

    const result = await makeClient().chat(
      chatRequest({
        thinking: 'enabled',
        reasoningEffort: 'high',
        temperature: 0.9,
        json: true,
      }),
    );

    expect(result.usage.costUsd).toBeCloseTo(0.0007824, 10);
    const body = requests[0]?.body as Record<string, unknown>;
    expect(body.thinking).toEqual({ type: 'enabled' });
    expect(body.reasoning_effort).toBe('high');
    expect(body.temperature).toBeUndefined();
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('computes the pro-model cost from config pricing', async () => {
    queue.push({ status: 200, body: completionBody() });

    const result = await makeClient().chat(chatRequest({ model: 'deepseek-v4-pro' }));

    expect(result.usage.costUsd).toBeCloseTo(0.0013948, 10);
    expect(computeCostUsd('deepseek-v4-pro', {
      promptTokens: 1000,
      completionTokens: 500,
      cacheHitTokens: 400,
      cacheMissTokens: 600,
    }, OFF_PEAK)).toBeCloseTo(0.0013948, 10);
  });

  it('retries 429 with Retry-After and then succeeds', async () => {
    queue.push({
      status: 429,
      body: { error: { message: 'rate limited' } },
      headers: { 'retry-after': '0' },
    });
    queue.push({ status: 200, body: completionBody() });

    const result = await makeClient().chat(chatRequest());

    expect(result.content).toBe('hello');
    expect(requests).toHaveLength(2);
  });

  it('does not retry 401', async () => {
    queue.push({ status: 401, body: { error: { message: 'bad key' } } });

    await expect(makeClient().chat(chatRequest())).rejects.toMatchObject({
      code: 'E_KEY_INVALID',
      status: 401,
      retryable: false,
    });
    expect(requests).toHaveLength(1);
  });

  it('fails typed on finish_reason length', async () => {
    queue.push({
      status: 200,
      body: completionBody({ content: '{"ok":', finish: 'length' }),
    });

    await expect(makeClient().chat(chatRequest({ json: true }))).rejects.toMatchObject({
      code: 'E_LLM_TRUNCATED',
      status: 200,
      retryable: false,
    });
    expect(requests).toHaveLength(1);
  });

  it('repairs blank JSON and returns valid data', async () => {
    queue.push({ status: 200, body: completionBody({ content: '   ' }) });
    queue.push({ status: 200, body: completionBody({ content: '{"ok":true}' }) });

    const result = await makeClient().structured(
      z.object({ ok: z.boolean() }),
      chatRequest({ json: true }),
    );

    expect(result.data).toEqual({ ok: true });
    expect(result.jsonRepairAttempts).toBe(1);
    expect(requests).toHaveLength(2);
  });

  it('fails typed after two blank-JSON repair attempts', async () => {
    const blank = { status: 200, body: completionBody({ content: '   ' }) };
    queue.push(blank, blank, blank);

    await expect(
      makeClient().structured(z.object({ ok: z.boolean() }), chatRequest({ json: true })),
    ).rejects.toMatchObject({
      code: 'E_LLM_EMPTY_JSON',
      status: 200,
      retryable: false,
    });
    expect(requests).toHaveLength(3);
  });

  it('repairs invalid JSON once and returns valid data', async () => {
    queue.push({ status: 200, body: completionBody({ content: 'not json' }) });
    queue.push({ status: 200, body: completionBody({ content: '{"ok":true}' }) });

    const result = await makeClient().structured(
      z.object({ ok: z.boolean() }),
      chatRequest({ json: true }),
    );

    expect(result.data).toEqual({ ok: true });
    expect(result.jsonRepairAttempts).toBe(1);
    expect(requests).toHaveLength(2);
  });

  it('returns typed models and balance data', async () => {
    const client = makeClient();

    const listed = await client.models();
    expect(listed[0]?.id).toBe('deepseek-flash');
    expect(listed[0]?.context_window).toBe(1_048_576);

    const balance = await client.balance();
    expect(balance.is_available).toBe(true);
    expect(balance.balance_infos[0]?.total_balance).toBe('6.82');
  });

  it('aborts when the caller signal aborts', async () => {
    queue.push({ status: 200, body: completionBody(), delayMs: 200 });
    const controller = new AbortController();
    const promise = makeClient().chat(chatRequest({ signal: controller.signal }));

    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    controller.abort();

    await expect(promise).rejects.toMatchObject({
      code: 'E_LLM_ABORTED',
      retryable: false,
    });
  });
});

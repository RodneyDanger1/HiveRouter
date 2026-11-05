import { describe, expect, it } from 'vitest';
import { DeepSeekClient } from '../../src/server/llm/client';

function okResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      id: 'x',
      object: 'chat.completion',
      created: 1,
      model: 'deepseek-flash',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('per-HTTP-attempt budget hooks', () => {
  it('opens and closes one reservation per actual HTTP retry, not per structured repair', async () => {
    let calls = 0;
    const starts: number[] = [];
    const ends: Array<{ attempt: number; cost: number | null }> = [];
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ error: { message: 'temporary' } }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      }
      return okResponse('ok');
    }) as typeof fetch;

    const client = new DeepSeekClient({
      apiKey: 'test-key',
      fetchImpl,
      maxAttempts: 2,
      sleep: async () => undefined,
    });

    const result = await client.chat({
      messages: [{ role: 'user', content: 'hi' }],
      onHttpAttemptStart: (attempt) => starts.push(attempt),
      onHttpAttemptEnd: (attempt, usage) => ends.push({ attempt, cost: usage?.costUsd ?? null }),
    });

    expect(result.content).toBe('ok');
    expect(calls).toBe(2);
    expect(starts).toEqual([1, 2]);
    expect(ends).toEqual([
      { attempt: 1, cost: null },
      { attempt: 2, cost: result.usage.costUsd },
    ]);
  });
});

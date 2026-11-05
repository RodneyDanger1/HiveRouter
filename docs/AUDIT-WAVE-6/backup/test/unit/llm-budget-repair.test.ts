import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DeepSeekClient } from '../../src/server/llm/client';

function response(content: string, completionTokens: number): Response {
  return new Response(
    JSON.stringify({
      id: 'x',
      object: 'chat.completion',
      created: 1,
      model: 'deepseek-flash',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: completionTokens, total_tokens: 10 + completionTokens },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('TD1-D10 — per-attempt structured budget hooks', () => {
  it('starts and ends every JSON-repair attempt with the fitted max_tokens', async () => {
    const bodies: number[] = [];
    const starts: number[] = [];
    const ends: Array<{ attempt: number; cost: number | null }> = [];
    let calls = 0;
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      const body = JSON.parse(String(init?.body ?? '{}')) as { max_tokens?: number };
      bodies.push(Number(body.max_tokens));
      return response(calls === 1 ? 'not-json' : JSON.stringify({ ok: true }), 8000);
    }) as typeof fetch;

    const client = new DeepSeekClient({ apiKey: 'test-key', fetchImpl, maxJsonRepairs: 2 });
    const result = await client.structured(z.object({ ok: z.literal(true) }), {
      messages: [{ role: 'user', content: 'x' }],
      maxTokens: 1000,
      onAttemptStart: (attempt) => {
        starts.push(attempt);
        return 600;
      },
      onAttemptEnd: (attempt, usage) => {
        ends.push({ attempt, cost: usage?.costUsd ?? null });
      },
    });

    expect(result.data).toEqual({ ok: true });
    expect(result.jsonRepairAttempts).toBe(1);
    expect(starts).toEqual([0, 1]);
    expect(ends.map((entry) => entry.attempt)).toEqual([0, 1]);
    expect(ends.every((entry) => typeof entry.cost === 'number')).toBe(true);
    expect(bodies).toEqual([600, 600]);
    expect(calls).toBe(2);
  });
});

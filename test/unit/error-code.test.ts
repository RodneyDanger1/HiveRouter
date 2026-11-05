import { describe, expect, it } from 'vitest';
import { LlmError } from '../../src/server/llm/client.js';
import { REFUSALS, codeOfError } from '../../src/shared/refusals.js';

describe('AF-06 codeOfError', () => {
  it('prefers LlmError.code over the prose message', () => {
    expect(codeOfError(new LlmError('E_LLM_RATE_LIMIT', 'DeepSeek rate limit reached after 3 attempts.'))).toBe('E_LLM_RATE_LIMIT');
  });

  it('reads a bare E_ code message', () => {
    expect(codeOfError(new Error('E_PROVIDER_EMPTY'))).toBe('E_PROVIDER_EMPTY');
  });

  it('keeps only the prefixed code, not the full message', () => {
    expect(codeOfError(new Error('E_AGENT_OUTPUT_MISMATCH: src/a.py != src/b.py'))).toBe('E_AGENT_OUTPUT_MISMATCH');
  });

  it('ignores a lowercase or non-matching code and falls through to E_INTERNAL', () => {
    const lowercase = Object.assign(new Error('lowercase code is not a run code'), { code: 'e_llm_rate_limit' });
    expect(codeOfError(lowercase)).toBe('E_INTERNAL');
    const hyphenated = Object.assign(new Error('not a run code shape'), { code: 'E-BAD' });
    expect(codeOfError(hyphenated)).toBe('E_INTERNAL');
  });

  it('classifies an AbortError with a prose message as E_INTERNAL (status mapping owns cancellation)', () => {
    const abort = new Error('The operation was aborted.');
    abort.name = 'AbortError';
    expect(codeOfError(abort)).toBe('E_INTERNAL');
  });

  it('handles non-Error throws without throwing', () => {
    expect(codeOfError('E_PROVIDER_TRUNCATED: output cut')).toBe('E_PROVIDER_TRUNCATED');
    expect(codeOfError({ code: 'ENOENT' })).toBe('E_INTERNAL');
    expect(codeOfError(null)).toBe('E_INTERNAL');
    expect(codeOfError(undefined)).toBe('E_INTERNAL');
    expect(codeOfError(42)).toBe('E_INTERNAL');
  });

  it('never turns a Node errno into a run error code', () => {
    for (const errno of ['ENOENT', 'ECONNREFUSED', 'ENOSPC']) {
      expect(codeOfError(Object.assign(new Error(`spawn failed with ${errno}`), { code: errno }))).toBe('E_INTERNAL');
    }
  });

  it('prefers a real LlmError code even when the message starts with another E_ code', () => {
    const error = Object.assign(new Error('E_PROVIDER_EMPTY'), { code: 'E_LLM_RATE_LIMIT' });
    expect(codeOfError(error)).toBe('E_LLM_RATE_LIMIT');
  });

  it('does not expand REFUSALS with the unregistered provider run codes', () => {
    for (const code of ['E_LLM_RATE_LIMIT', 'E_PROVIDER_EMPTY', 'E_PROVIDER_TRUNCATED', 'E_CANCELLED', 'E_RUN_TIMEOUT', 'GATE_FAILED']) {
      expect(code in REFUSALS).toBe(false);
    }
  });
});

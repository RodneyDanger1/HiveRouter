import { describe, expect, it } from 'vitest';
import { formatChatTokenUsage } from '../../src/shared/chat.js';

describe('chat token usage projection', () => {
  it('keeps both measured counts when present', () => {
    expect(formatChatTokenUsage({ promptTokens: 120, completionTokens: 45 })).toBe('120 in / 45 out');
  });

  it('does not turn a missing completion count into zero', () => {
    expect(formatChatTokenUsage({ promptTokens: 120, completionTokens: null })).toBe(
      '120 in / completion not reported',
    );
  });

  it('does not discard a measured completion count when prompt usage is missing', () => {
    expect(formatChatTokenUsage({ promptTokens: null, completionTokens: 45 })).toBe(
      'prompt not reported / 45 out',
    );
  });

  it('reports unknown when neither count is measured', () => {
    expect(formatChatTokenUsage({ promptTokens: null, completionTokens: null })).toBe('not reported');
    expect(formatChatTokenUsage(null)).toBe('not reported');
  });
});

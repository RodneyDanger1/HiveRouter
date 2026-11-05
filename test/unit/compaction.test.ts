import { describe, expect, it } from 'vitest';
import { compactEvidence } from '../../src/server/context/compaction';

const sample = [
  'Sure, here is the implementation.',
  '',
  '[[KEEP:contract]]',
  'API: POST /api/runs',
  'contract: HiveApi',
  '[[/KEEP]]',
  '',
  '```ts',
  'export type Run = { id: string };',
  'const target = "src/app.ts";',
  '```',
  '',
  'type Evidence = {',
  '  path: string;',
  '  check: "syntax";',
  '};',
  '',
  'src/app.ts',
  'check:syntax pass',
  'hash 0123456789abcdef0123456789abcdef',
  'That is all; let me know.',
].join('\n');

describe('compactEvidence', () => {
  it('strips only conversational lines while preserving tagged, fenced, type, and evidence content', () => {
    const result = compactEvidence(sample);

    expect(result.refusal).toBeUndefined();
    expect(result.compacted).not.toContain('Sure, here is the implementation.');
    expect(result.compacted).not.toContain('That is all; let me know.');
    expect(result.compacted).toContain('[[KEEP:contract]]');
    expect(result.compacted).toContain('API: POST /api/runs');
    expect(result.compacted).toContain('contract: HiveApi');
    expect(result.compacted).toContain('[[/KEEP]]');
    expect(result.compacted).toContain('```ts');
    expect(result.compacted).toContain('export type Run = { id: string };');
    expect(result.compacted).toContain('type Evidence = {');
    expect(result.compacted).toContain('  check: "syntax";');
    expect(result.compacted).toContain('src/app.ts');
    expect(result.compacted).toContain('check:syntax pass');
    expect(result.compacted).toContain('hash 0123456789abcdef0123456789abcdef');
    expect(result.preservedBlocks).toBeGreaterThanOrEqual(5);
    expect(result.removedChars).toBe(sample.length - result.compacted.length);
    expect(result.removedChars).toBeGreaterThan(0);
    expect(result.truncated).toBe(true);
    expect(result.pointer).toMatch(/^compact:[a-f0-9]{16}$/);
    expect(result.compacted.length).toBeLessThanOrEqual(sample.length);
  });

  it('is deterministic and bounded by maxChars on success', () => {
    const first = compactEvidence(sample);
    const second = compactEvidence(sample);
    expect(second.compacted).toBe(first.compacted);
    expect(second.pointer).toBe(first.pointer);

    const bounded = compactEvidence(sample, { maxChars: first.compacted.length });
    expect(bounded.refusal).toBeUndefined();
    expect(bounded.compacted.length).toBeLessThanOrEqual(first.compacted.length);
  });

  it('returns the original untouched for an unclosed fence', () => {
    const input = ['Here is code:', '```ts', 'const value = 1;'].join('\n');
    const result = compactEvidence(input);
    expect(result.refusal?.code).toBe('E_COMPACTION_UNCLOSED_BLOCK');
    expect(result.compacted).toBe(input);
    expect(result.removedChars).toBe(0);
    expect(result.preservedBlocks).toBe(0);
    expect(result.pointer).toBeNull();
    expect(result.truncated).toBe(false);
  });

  it('returns the original untouched for an unclosed KEEP block', () => {
    const input = ['[[KEEP:contract]]', 'API: POST /api/runs'].join('\n');
    const result = compactEvidence(input);
    expect(result.refusal?.code).toBe('E_COMPACTION_UNCLOSED_BLOCK');
    expect(result.compacted).toBe(input);
    expect(result.removedChars).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it('refuses malformed KEEP markers and stray closes without changing the input', () => {
    const invalidOpen = '[[KEEP:]]\nAPI: keep';
    const openResult = compactEvidence(invalidOpen);
    expect(openResult.refusal?.code).toBe('E_COMPACTION_MALFORMED_MARKER');
    expect(openResult.compacted).toBe(invalidOpen);

    const strayClose = 'API: keep\n[[/KEEP]]';
    const closeResult = compactEvidence(strayClose);
    expect(closeResult.refusal?.code).toBe('E_COMPACTION_MALFORMED_MARKER');
    expect(closeResult.compacted).toBe(strayClose);

    const brokenOpen = '[[KEEP:]] trailing';
    expect(compactEvidence(brokenOpen).refusal?.code).toBe('E_COMPACTION_MALFORMED_MARKER');
    const brokenClose = 'API: keep [[/KEEP]]';
    expect(compactEvidence(brokenClose).refusal?.code).toBe('E_COMPACTION_MALFORMED_MARKER');
  });

  it('preserves an inline KEEP line', () => {
    const input = ['[[KEEP:note]] This sentence must survive.', 'Sure, remove this filler.'].join('\n');
    const result = compactEvidence(input);
    expect(result.compacted).toContain('[[KEEP:note]] This sentence must survive.');
    expect(result.compacted).not.toContain('Sure, remove this filler.');
  });

  it('preserves a contract block and a multiline mandatory snippet', () => {
    const input = [
      'Sure, filler.',
      'Contract:',
      '{',
      '  input: string;',
      '  output: string;',
      '}',
      'Block A',
      'Block B',
      'That is all.',
    ].join('\n');
    const result = compactEvidence(input, { mandatory: ['Block A\nBlock B'] });
    expect(result.refusal).toBeUndefined();
    expect(result.compacted).toContain('Contract:');
    expect(result.compacted).toContain('  input: string;');
    expect(result.compacted).toContain('  output: string;');
    expect(result.compacted).toContain('Block A\nBlock B');
    expect(result.compacted).not.toContain('Sure, filler.');
    expect(result.compacted).not.toContain('That is all.');
  });

  it('does not strip a filler-looking line that carries a path', () => {
    const input = ['Note that src/app.ts is required.', 'Sure, remove this filler.'].join('\n');
    const result = compactEvidence(input);
    expect(result.compacted).toContain('Note that src/app.ts is required.');
    expect(result.compacted).not.toContain('Sure, remove this filler.');
  });

  it('preserves mandatory snippets and refuses when one is missing', () => {
    const input = ['Important finding: keep this.', 'Sure, remove this filler.'].join('\n');
    const result = compactEvidence(input, { mandatory: ['Important finding: keep this.'] });
    expect(result.refusal).toBeUndefined();
    expect(result.compacted).toContain('Important finding: keep this.');
    expect(result.compacted).not.toContain('Sure, remove this filler.');

    const missing = compactEvidence('only prose', { mandatory: ['not present'] });
    expect(missing.refusal?.code).toBe('E_COMPACTION_MANDATORY_MISSING');
    expect(missing.compacted).toBe('only prose');
    expect(missing.removedChars).toBe(0);
    expect(missing.truncated).toBe(false);
  });

  it('is all-or-nothing when preservation would exceed maxChars', () => {
    const input = ['Sure, filler.', '[[KEEP:contract]]', 'API: POST /api/runs', '[[/KEEP]]'].join('\n');
    const result = compactEvidence(input, { maxChars: 10 });
    expect(result.refusal?.code).toBe('E_COMPACTION_OUTPUT_TOO_LARGE');
    expect(result.compacted).toBe(input);
    expect(result.removedChars).toBe(0);
    expect(result.preservedBlocks).toBe(0);
    expect(result.pointer).toBeNull();
    expect(result.truncated).toBe(false);
  });

  it('refuses oversized input untouched', () => {
    const input = 'src/app.ts';
    const result = compactEvidence(input, { maxInputChars: 3 });
    expect(result.refusal?.code).toBe('E_COMPACTION_INPUT_TOO_LARGE');
    expect(result.compacted).toBe(input);
    expect(result.removedChars).toBe(0);
  });

  it('leaves already-clean technical content byte-identical', () => {
    const input = [
      'type Evidence = {',
      '  path: string;',
      '};',
      'src/app.ts',
      'check:syntax pass',
    ].join('\n');
    const result = compactEvidence(input);
    expect(result.refusal).toBeUndefined();
    expect(result.compacted).toBe(input);
    expect(result.removedChars).toBe(0);
    expect(result.pointer).toBeNull();
    expect(result.truncated).toBe(false);
    expect(result.preservedBlocks).toBeGreaterThan(0);
  });

  it('preserves CRLF content when nothing is eligible', () => {
    const input = 'type Evidence = {\r\n  path: string;\r\n};\r\nsrc/app.ts\r\n';
    const result = compactEvidence(input);
    expect(result.refusal).toBeUndefined();
    expect(result.compacted).toBe(input);
    expect(result.removedChars).toBe(0);
  });

  it('validates options and input at the boundary', () => {
    expect(compactEvidence('x', { maxChars: 0 }).refusal?.code).toBe('E_COMPACTION_INVALID_OPTIONS');
    expect(compactEvidence('x', { maxChars: '100' as never }).refusal?.code).toBe('E_COMPACTION_INVALID_OPTIONS');
    expect(compactEvidence('x', { maxInputChars: 0 }).refusal?.code).toBe('E_COMPACTION_INVALID_OPTIONS');
    expect(compactEvidence('x', { mandatory: [''] }).refusal?.code).toBe('E_COMPACTION_INVALID_OPTIONS');
    expect(compactEvidence('x', { mandatory: [42 as never] }).refusal?.code).toBe('E_COMPACTION_INVALID_OPTIONS');
    expect(compactEvidence('x', null as never).refusal?.code).toBe('E_COMPACTION_INVALID_OPTIONS');
    expect(compactEvidence(42 as never).refusal?.code).toBe('E_COMPACTION_INPUT_INVALID');
  });

  it('handles empty input without inventing content', () => {
    const result = compactEvidence('');
    expect(result.refusal).toBeUndefined();
    expect(result.compacted).toBe('');
    expect(result.removedChars).toBe(0);
    expect(result.preservedBlocks).toBe(0);
    expect(result.pointer).toBeNull();
    expect(result.truncated).toBe(false);
  });
});

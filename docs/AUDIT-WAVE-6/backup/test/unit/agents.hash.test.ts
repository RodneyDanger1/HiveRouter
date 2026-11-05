import { describe, expect, it } from 'vitest';
import { sha256 } from '../../src/server/agents/hash.js';
import { PROMPT_HASHES, REGISTRY, hashPrompt } from '../../src/server/agents/registry.js';
import { promptHash } from '../../src/server/agents/prompts.js';

describe('pure sha256 and prompt hashes', () => {
  it('matches the FIPS 180-4 test vectors', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    expect(sha256('The quick brown fox jumps over the lazy dog')).toBe(
      'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
    );
  });

  it('keeps the registry hash helpers on the same pure implementation', () => {
    expect(hashPrompt('abc')).toBe(sha256('abc'));
    expect(promptHash('abc')).toBe(sha256('abc'));
  });

  it('has 37 stable, unique prompt hashes', () => {
    const hashes = Object.values(PROMPT_HASHES);
    expect(hashes).toHaveLength(37);
    expect(new Set(hashes).size).toBe(37);
    for (const hash of hashes) expect(hash).toMatch(/^[0-9a-f]{64}$/);
    for (const agent of REGISTRY) {
      expect(PROMPT_HASHES[agent.id]).toBe(sha256(agent.prompt));
      expect(PROMPT_HASHES[agent.id]).toBe(PROMPT_HASHES[agent.id]);
    }
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initDb } from '../../src/server/db/database.js';
import { createApprovalService, type ApprovalBinding } from '../../src/server/learning/index.js';

let nowValue: Date;

const binding: ApprovalBinding = {
  action: 'promote',
  candidateHash: 'candidate-hash',
  evalHash: 'eval-hash',
  baselineVersionId: 'baseline-version',
  suiteUseId: 'suite-use-1',
};

function service() {
  return createApprovalService({
    secret: Buffer.alloc(32, 7),
    now: () => nowValue,
    ttlMs: 10 * 60 * 1000,
  });
}

beforeEach(() => {
  closeDb();
  initDb(':memory:', 'B2');
  nowValue = new Date('2026-11-03T12:00:00.000Z');
});

afterEach(() => {
  closeDb();
});

describe('learning approval tokens', () => {
  it('issues and consumes a single-use token with the exact binding', () => {
    const approval = service();
    const issued = approval.issue(binding);
    const consumed = approval.consume({ token: issued.token, expected: binding });
    expect(consumed.jti).toBe(issued.jti);
    expect(consumed.candidateHash).toBe(binding.candidateHash);
    const row = getDb()
      .prepare('SELECT consumed_at, token_sha256 FROM approval_tokens WHERE jti = ?')
      .get(issued.jti) as { consumed_at: string | null; token_sha256: string };
    expect(row.consumed_at).not.toBeNull();
    expect(row.token_sha256).toHaveLength(64);
  });

  it('refuses replay and expiry', () => {
    const approval = service();
    const issued = approval.issue(binding);
    approval.consume({ token: issued.token, expected: binding });
    expect(() => approval.consume({ token: issued.token, expected: binding })).toThrow(
      /already consumed/,
    );

    nowValue = new Date('2026-11-03T12:00:00.000Z');
    const second = approval.issue(binding);
    nowValue = new Date('2026-11-03T12:11:00.000Z');
    expect(() => approval.consume({ token: second.token, expected: binding })).toThrow(
      /expired/,
    );
  });

  it('refuses a tampered signature and a wrong binding', () => {
    const approval = service();
    const issued = approval.issue(binding);
    const tampered = `${issued.token.slice(0, -1)}${issued.token.endsWith('a') ? 'b' : 'a'}`;
    expect(() => approval.consume({ token: tampered, expected: binding })).toThrow(
      /signature mismatch|approval token/i,
    );

    const second = approval.issue(binding);
    expect(() =>
      approval.consume({
        token: second.token,
        expected: { ...binding, baselineVersionId: 'other-baseline' },
      }),
    ).toThrow(/binding mismatch/);

    const third = approval.issue(binding);
    expect(() =>
      approval.consume({
        token: third.token,
        expected: { ...binding, action: 'rollback' },
      }),
    ).toThrow(/binding mismatch/);
  });

  it('refuses a malformed token', () => {
    const approval = service();
    expect(() =>
      approval.consume({ token: 'not-a-token', expected: binding }),
    ).toThrow(/malformed approval token/);
  });

  it('refuses an unparseable persisted expiry', () => {
    const approval = service();
    const issued = approval.issue(binding);
    getDb()
      .prepare('UPDATE approval_tokens SET expires_at = ? WHERE jti = ?')
      .run('not-a-date', issued.jti);
    expect(() => approval.consume({ token: issued.token, expected: binding })).toThrow(
      /expired|invalid expiry/i,
    );
  });
});

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/database.js';
import { config } from '../config.js';
import { sha256 } from '../security/redact.js';
import { refuse } from './errors.js';

export type ApprovalAction = 'promote' | 'rollback';

export interface ApprovalBinding {
  action: ApprovalAction;
  candidateHash: string;
  evalHash: string;
  baselineVersionId: string;
  suiteUseId: string;
}

export interface IssuedApprovalToken {
  token: string;
  jti: string;
  expiresAt: string;
}

export interface ConsumedApprovalToken extends ApprovalBinding {
  jti: string;
  issuedAt: string;
  expiresAt: string;
}

interface TokenPayload extends ApprovalBinding {
  jti: string;
  issuedAt: string;
  expiresAt: string;
}

interface ApprovalRow {
  jti: string;
  token_sha256: string;
  action: string;
  candidate_hash: string;
  eval_hash: string;
  baseline_version_id: string;
  suite_use_id: string;
  issued_at: string;
  expires_at: string;
  consumed_at: string | null;
}

export interface ApprovalService {
  issue(binding: ApprovalBinding): IssuedApprovalToken;
  consume(input: { token: string; expected: ApprovalBinding }): ConsumedApprovalToken;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;

function secretPath(): string {
  return path.join(config.dataDir, 'secrets', 'learning-approval.key');
}

function loadOrCreateSecret(): Buffer {
  const file = secretPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    const buffer = Buffer.from(existing, 'hex');
    if (buffer.length === 32) return buffer;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const created = crypto.randomBytes(32);
  try {
    fs.writeFileSync(file, created.toString('hex'), { mode: 0o600, flag: 'wx', encoding: 'utf8' });
    return created;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      const existing = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'hex');
      if (existing.length === 32) return existing;
    }
    throw error;
  }
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(secret: Buffer, encodedPayload: string): string {
  return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function assertBinding(binding: ApprovalBinding): void {
  for (const [key, value] of Object.entries(binding)) {
    if (typeof value !== 'string' || value.length === 0) {
      refuse('E_LEARNING_APPROVAL_REQUIRED', `invalid approval binding: ${key}`);
    }
  }
  if (binding.action !== 'promote' && binding.action !== 'rollback') {
    refuse('E_LEARNING_APPROVAL_REQUIRED', 'invalid approval action');
  }
}

export function createApprovalService(options: {
  secret?: Buffer;
  now?: () => Date;
  ttlMs?: number;
} = {}): ApprovalService {
  const secret = options.secret ?? loadOrCreateSecret();
  if (secret.length !== 32) {
    refuse('E_LEARNING_APPROVAL_REQUIRED', 'approval secret must be 32 bytes');
  }
  const now = options.now ?? (() => new Date());
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;

  return {
    issue(binding: ApprovalBinding): IssuedApprovalToken {
      assertBinding(binding);
      const issued = now();
      const expires = new Date(issued.getTime() + ttlMs);
      const payload: TokenPayload = {
        ...binding,
        jti: crypto.randomUUID(),
        issuedAt: issued.toISOString(),
        expiresAt: expires.toISOString(),
      };
      const encodedPayload = encode(JSON.stringify(payload));
      const token = `v1.${encodedPayload}.${sign(secret, encodedPayload)}`;
      getDb()
        .prepare(
          `INSERT INTO approval_tokens
           (jti, token_sha256, action, candidate_hash, eval_hash, baseline_version_id, suite_use_id, issued_at, expires_at, consumed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        )
        .run(
          payload.jti,
          sha256(token),
          payload.action,
          payload.candidateHash,
          payload.evalHash,
          payload.baselineVersionId,
          payload.suiteUseId,
          payload.issuedAt,
          payload.expiresAt,
        );
      return { token, jti: payload.jti, expiresAt: payload.expiresAt };
    },

    consume(input: { token: string; expected: ApprovalBinding }): ConsumedApprovalToken {
      assertBinding(input.expected);
      const parts = input.token.split('.');
      if (parts.length !== 3 || parts[0] !== 'v1') {
        refuse('E_LEARNING_APPROVAL_REQUIRED', 'malformed approval token');
      }
      const encodedPayload = parts[1]!;
      const suppliedSignature = parts[2]!;
      if (!safeEqual(suppliedSignature, sign(secret, encodedPayload))) {
        refuse('E_LEARNING_EVIDENCE_TAMPERED', 'approval token signature mismatch');
      }
      let payload: TokenPayload;
      try {
        payload = JSON.parse(decode(encodedPayload)) as TokenPayload;
      } catch {
        refuse('E_LEARNING_APPROVAL_REQUIRED', 'approval token payload is not valid JSON');
      }
      const row = getDb()
        .prepare('SELECT * FROM approval_tokens WHERE jti = ?')
        .get(payload.jti) as ApprovalRow | undefined;
      if (!row) refuse('E_LEARNING_APPROVAL_REQUIRED', 'approval token was not issued');
      if (row.token_sha256 !== sha256(input.token)) {
        refuse('E_LEARNING_EVIDENCE_TAMPERED', 'approval token hash mismatch');
      }
      for (const key of ['action', 'candidateHash', 'evalHash', 'baselineVersionId', 'suiteUseId'] as const) {
        if ((payload[key] as string) !== (input.expected[key] as string)) {
          refuse('E_LEARNING_EVIDENCE_TAMPERED', `approval token binding mismatch: ${key}`);
        }
      }
      if (
        row.action !== input.expected.action ||
        row.candidate_hash !== input.expected.candidateHash ||
        row.eval_hash !== input.expected.evalHash ||
        row.baseline_version_id !== input.expected.baselineVersionId ||
        row.suite_use_id !== input.expected.suiteUseId
      ) {
        refuse('E_LEARNING_EVIDENCE_TAMPERED', 'approval token row binding mismatch');
      }
      if (row.consumed_at !== null) {
        refuse('E_LEARNING_APPROVAL_EXPIRED', 'approval token was already consumed');
      }
      const expiresAt = Date.parse(row.expires_at);
      if (!Number.isFinite(expiresAt)) {
        refuse('E_LEARNING_APPROVAL_EXPIRED', 'approval token has an invalid expiry');
      }
      if (expiresAt <= now().getTime()) {
        refuse('E_LEARNING_APPROVAL_EXPIRED', 'approval token is expired');
      }
      const updated = getDb()
        .prepare('UPDATE approval_tokens SET consumed_at = ? WHERE jti = ? AND consumed_at IS NULL')
        .run(now().toISOString(), payload.jti);
      if (updated.changes !== 1) {
        refuse('E_LEARNING_APPROVAL_EXPIRED', 'approval token was consumed concurrently');
      }
      return {
        jti: payload.jti,
        action: payload.action,
        candidateHash: payload.candidateHash,
        evalHash: payload.evalHash,
        baselineVersionId: payload.baselineVersionId,
        suiteUseId: payload.suiteUseId,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
      };
    },
  };
}

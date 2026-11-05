import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { redactString, fingerprint } from './redact.js';

export type KeySource = 'environment' | 'app-secret' | 'none';

interface CachedKey {
  key: string | null;
  source: KeySource;
  loadedAt: number;
}

let cached: CachedKey = { key: null, source: 'none', loadedAt: 0 };

function readAppSecret(): string | null {
  const file = path.join(config.dataDir, 'secrets', 'deepseek.json');
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { apiKey?: unknown };
    return typeof parsed.apiKey === 'string' && parsed.apiKey.trim().length > 0 ? parsed.apiKey.trim() : null;
  } catch {
    return null;
  }
}

export function resolveKey(force = false): CachedKey {
  if (!force && cached.loadedAt > 0 && Date.now() - cached.loadedAt < 5000) return cached;
  const envKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (envKey) {
    cached = { key: envKey, source: 'environment', loadedAt: Date.now() };
    return cached;
  }
  const appKey = readAppSecret();
  if (appKey) {
    cached = { key: appKey, source: 'app-secret', loadedAt: Date.now() };
    return cached;
  }
  cached = { key: null, source: 'none', loadedAt: Date.now() };
  return cached;
}

export function keyStatus(): { configured: boolean; source: KeySource; fingerprint: string | null } {
  const resolved = resolveKey();
  return {
    configured: Boolean(resolved.key),
    source: resolved.source,
    fingerprint: resolved.key ? fingerprint(resolved.key) : null,
  };
}

export function requireKey(): string {
  const resolved = resolveKey();
  if (!resolved.key) throw new Error('E_KEY_NOT_CONFIGURED');
  return resolved.key;
}

export function saveAppKey(apiKey: string): void {
  const trimmed = apiKey.trim();
  if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(trimmed)) throw new Error('E_KEY_INVALID');
  const dir = path.join(config.dataDir, 'secrets');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'deepseek.json');
  fs.writeFileSync(file, JSON.stringify({ apiKey: trimmed }), { encoding: 'utf8', mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Windows ACLs are user-scoped; the file remains outside the repo.
  }
  resolveKey(true);
}

export function clearAppKey(): void {
  const file = path.join(config.dataDir, 'secrets', 'deepseek.json');
  if (fs.existsSync(file)) fs.rmSync(file, { force: true });
  resolveKey(true);
}

export function redactedKeyForLog(): string {
  const resolved = resolveKey();
  return resolved.key ? `${resolved.key.slice(0, 3)}…${fingerprint(resolved.key)}` : 'none';
}

export function setKeyForTests(key: string | null): void {
  if (key) {
    process.env.DEEPSEEK_API_KEY = key;
  } else {
    delete process.env.DEEPSEEK_API_KEY;
  }
  resolveKey(true);
}

export function keyFingerprint(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 8);
}

export function safeKeyLog(key: string): string {
  return redactString(`${key.slice(0, 3)}…${keyFingerprint(key)}`);
}

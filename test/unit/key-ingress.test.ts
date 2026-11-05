import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../../src/server/config.js';
import { clearAppKey, keyStatus, resolveKey, saveAppKey } from '../../src/server/security/keys.js';

const VALID_KEY = 'sk-' + 'a'.repeat(24);
let tmpRoot = '';
let savedDataDir = '';
let savedEnv: string | undefined;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-key-ingress-'));
  savedDataDir = config.dataDir;
  savedEnv = process.env.DEEPSEEK_API_KEY;
  (config as unknown as { dataDir: string }).dataDir = path.join(tmpRoot, 'data');
  delete process.env.DEEPSEEK_API_KEY;
  clearAppKey();
});

afterEach(() => {
  clearAppKey();
  (config as unknown as { dataDir: string }).dataDir = savedDataDir;
  if (savedEnv === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = savedEnv;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('local key ingress', () => {
  it('reports an app-secret key without exposing the key material', () => {
    saveAppKey(VALID_KEY);

    const status = keyStatus();
    expect(status.configured).toBe(true);
    expect(status.source).toBe('app-secret');
    expect(status.fingerprint).toMatch(/^[a-f0-9]{8}$/);
    expect(JSON.stringify(status)).not.toContain(VALID_KEY);
    expect(resolveKey(true).key).toBe(VALID_KEY);
  });

  it('ignores an oversized app-secret file', () => {
    const dir = path.join(config.dataDir, 'secrets');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'deepseek.json'), JSON.stringify({ apiKey: VALID_KEY, padding: 'x'.repeat(70_000) }));
    expect(keyStatus().configured).toBe(false);
    expect(resolveKey(true).key).toBeNull();
  });

  it('ignores a malformed app-secret file', () => {
    const dir = path.join(config.dataDir, 'secrets');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'deepseek.json'), JSON.stringify({ apiKey: 'not-a-deepseek-key' }));
    expect(keyStatus().configured).toBe(false);
  });

  it('ignores a missing app-secret file', () => {
    expect(keyStatus().configured).toBe(false);
    expect(keyStatus().source).toBe('none');
  });
});

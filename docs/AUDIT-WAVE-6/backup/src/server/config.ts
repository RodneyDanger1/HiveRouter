import './env.js';
import path from 'node:path';
import fs from 'node:fs';
import { PHASE } from '../shared/features.js';

const ROOT = path.resolve(process.cwd());

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

function dirEnv(name: string, fallback: string): string {
  const raw = process.env[name];
  const resolved = raw ? path.resolve(ROOT, raw) : path.join(ROOT, fallback);
  return resolved;
}

export const config = {
  root: ROOT,
  dataDir: dirEnv('HIVE_DATA_DIR', 'data'),
  workspaceDir: dirEnv('HIVE_WORKSPACE_DIR', 'workspace'),
  vaultDir: dirEnv('HIVE_VAULT_DIR', 'vault'),
  host: process.env.HOST ?? '127.0.0.1',
  port: intEnv('PORT', 8787, 1, 65535),
  phase: PHASE,
  model: (process.env.DEFAULT_MODEL ?? 'deepseek-flash') as 'deepseek-flash' | 'deepseek-v4-pro',
  baseUrl: (process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/+$/, ''),
  limits: {
    briefChars: 8000,
    maxFiles: 24,
    maxFileBytes: 256 * 1024,
    maxContextChars: 500_000,
    maxOutputTokens: 65_536,
    maxAttempts: 3,
    maxRepairs: 2,
    maxRunCostUsd: Number(process.env.MAX_RUN_COST_USD ?? 0.5),
    evalCostUsd: 3,
    cycleCostUsd: 4.5,
    runTimeoutMs: intEnv('RUN_TIMEOUT_MS', 30 * 60 * 1000, 1_000, 24 * 60 * 60 * 1000),
    requestTimeoutMs: 5 * 60 * 1000,
    eventReplayWindow: 500,
    eventPayloadMaxBytes: 8 * 1024,
    retentionDays: { events: 90, context: 30, traces: 180, eval: 365 },
  },
  pricing: {
    'deepseek-flash': {
      cacheHitOffPeak: 0.003,
      cacheHitPeak: 0.006,
      cacheMissOffPeak: 0.15,
      cacheMissPeak: 0.3,
      outputOffPeak: 0.6,
      outputPeak: 1.2,
    },
    'deepseek-v4-pro': {
      cacheHitOffPeak: 0.022,
      cacheHitPeak: 0.044,
      cacheMissOffPeak: 0.66,
      cacheMissPeak: 1.32,
      outputOffPeak: 1.98,
      outputPeak: 3.96,
    },
  },
  dshCredentialsPath: path.join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.dsh', '.credentials.yaml'),
} as const;

export function ensureRuntimeDirs(): void {
  for (const dir of [
    config.dataDir,
    config.workspaceDir,
    config.vaultDir,
    path.join(config.dataDir, 'reports'),
    path.join(config.dataDir, 'learning'),
    path.join(config.dataDir, 'replay'),
    path.join(config.dataDir, 'logs'),
    path.join(config.dataDir, 'secrets'),
    path.join(config.workspaceDir, 'runs'),
    path.join(config.vaultDir, '000_Hive_Control'),
    path.join(config.vaultDir, '100_Blueprints'),
    path.join(config.vaultDir, '200_Production_Forge'),
    path.join(config.vaultDir, '300_Creative_Vault'),
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

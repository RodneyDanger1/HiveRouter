import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../../src/server/config.js';
import { closeDb, initDb } from '../../src/server/db/database.js';
import { LlmError } from '../../src/server/llm/client.js';
import { createRun, setExecutor } from '../../src/server/runs/manager.js';
import { getEvents, getRun } from '../../src/server/runs/recorder.js';

let tmpRoot = '';
let savedDataDir = '';
let savedWorkspaceDir = '';

beforeEach(() => {
  closeDb();
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-terminal-error-code-'));
  savedDataDir = config.dataDir;
  savedWorkspaceDir = config.workspaceDir;
  (config as unknown as { dataDir: string }).dataDir = path.join(tmpRoot, 'data');
  (config as unknown as { workspaceDir: string }).workspaceDir = path.join(tmpRoot, 'workspace');
  initDb(':memory:', 'B2');
});

afterEach(() => {
  closeDb();
  (config as unknown as { dataDir: string }).dataDir = savedDataDir;
  (config as unknown as { workspaceDir: string }).workspaceDir = savedWorkspaceDir;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('AF-06 terminal error identity', () => {
  it('persists the provider LlmError code through the executor rejection path', async () => {
    const rateLimit = new LlmError('E_LLM_RATE_LIMIT', 'DeepSeek rate limit reached after 3 attempts.');
    setExecutor(() => Promise.reject(rateLimit));
    try {
      const created = await createRun({
        brief: 'provider rate limit specimen',
        preset: 'docs',
        model: 'deepseek-flash',
        thinking: 'disabled',
        effort: null,
        idempotencyKey: 'terminal-error-code-0001',
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const run = getRun(created.runId);
      expect(run?.status).toBe('failed');
      expect(run?.errorCode).toBe('E_LLM_RATE_LIMIT');
      // The human sentence is preserved, never replaced by the code.
      expect(run?.errorMessage).toBe('DeepSeek rate limit reached after 3 attempts.');

      const events = getEvents(created.runId);
      const terminal = events[events.length - 1];
      expect(terminal?.type).toBe('run.failed');
      expect(terminal?.payload.code).toBe('E_LLM_RATE_LIMIT');
      expect(terminal?.payload.message).toBe('DeepSeek rate limit reached after 3 attempts.');
      expect(terminal?.payload.message).not.toBe(terminal?.payload.code);
    } finally {
      setExecutor(async () => undefined);
    }
  });
});

import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { config } from '../../src/server/config.js';
import { closeDb, initDb } from '../../src/server/db/database.js';
import { createRun, getActiveRunId, runWorkspace, setExecutor } from '../../src/server/runs/manager.js';
import { getRun } from '../../src/server/runs/recorder.js';

afterEach(() => {
  closeDb();
});

describe('run wall-clock timeout', () => {
  it('aborts a non-settling executor and records E_RUN_TIMEOUT', async () => {
    initDb(':memory:');
    const original = config.limits.runTimeoutMs;
    (config.limits as unknown as { runTimeoutMs: number }).runTimeoutMs = 80;
    const runs: string[] = [];
    setExecutor(
      ({ runId, signal }) =>
        new Promise<void>((_resolve, reject) => {
          runs.push(runId);
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
    );

    try {
      const created = await createRun({
        brief: 'timeout test',
        preset: 'docs',
        model: 'deepseek-flash',
        thinking: 'disabled',
        effort: null,
        idempotencyKey: 'timeout-test-key-0001',
      });
      await new Promise((resolve) => setTimeout(resolve, 250));
      const run = getRun(created.runId);
      expect(run?.status).toBe('failed');
      expect(run?.errorCode).toBe('E_RUN_TIMEOUT');
      expect(getActiveRunId()).toBeNull();
      expect(runs).toContain(created.runId);
    } finally {
      (config.limits as unknown as { runTimeoutMs: number }).runTimeoutMs = original;
      fs.rmSync(runWorkspace(runs[0] ?? 'none'), { recursive: true, force: true });
    }
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initDb } from '../../src/server/db/database.js';
import { buildApp } from '../../src/server/app.js';
import { config } from '../../src/server/config.js';
import { createRun, runWorkspace, setExecutor } from '../../src/server/runs/manager.js';
import { getArtifacts, getRun } from '../../src/server/runs/recorder.js';
import { executeRun, persistStagedArtifacts } from '../../src/server/pipeline/run.js';

async function waitForTerminal(runId: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const run = getRun(runId);
    if (run && ['completed', 'completed_with_warnings', 'failed', 'cancelled', 'budget_exceeded', 'interrupted'].includes(run.status)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`run ${runId} did not settle`);
}

beforeEach(() => {
  initDb(':memory:', 'B2');
});

afterEach(() => {
  setExecutor(async () => undefined);
  closeDb();
});

describe('resume from retained staged files', () => {
  it('re-verifies and publishes staged files without a provider call', async () => {
    setExecutor(async ({ runId }) => {
      const staging = path.join(runWorkspace(runId), '.staging', 'attempt-1');
      fs.mkdirSync(path.join(staging, 'src'), { recursive: true });
      fs.writeFileSync(path.join(staging, 'src', 'app.js'), 'export const answer = 42;\n', 'utf8');
      throw new Error('E_TEST_GENERATION_FAILED');
    });
    const parent = await createRun({
      brief: 'resume fixture parent',
      preset: 'docs',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      idempotencyKey: 'resume-parent-key-0001',
    });
    await waitForTerminal(parent.runId);
    expect(getRun(parent.runId)?.status).toBe('failed');
    expect(persistStagedArtifacts(parent.runId)).toBe(1);

    setExecutor(executeRun);
    const child = await createRun({
      brief: 'resume fixture child',
      preset: 'docs',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      idempotencyKey: 'resume-child-key-0001',
      parentRunId: parent.runId,
      runKind: 'resume',
    });
    await waitForTerminal(child.runId);
    const resumed = getRun(child.runId);
    expect(resumed?.status).toBe('completed');
    expect(resumed?.runKind).toBe('resume');
    expect(getArtifacts(child.runId).map((artifact) => artifact.path)).toContain('src/app.js');
    expect(getRun(parent.runId)?.status).toBe('failed');
  });

  it('refuses a resume when the parent has no retained staged directory', async () => {
    setExecutor(async () => {
      throw new Error('E_TEST_PARENT_FAILED');
    });
    const parent = await createRun({
      brief: 'resume fixture without staging',
      preset: 'docs',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      idempotencyKey: 'resume-parent-key-0002',
    });
    await waitForTerminal(parent.runId);
    expect(persistStagedArtifacts(parent.runId)).toBe(0);
    setExecutor(executeRun);
    const child = await createRun({
      brief: 'resume fixture without staging child',
      preset: 'docs',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      idempotencyKey: 'resume-child-key-0002',
      parentRunId: parent.runId,
      runKind: 'resume',
    });
    await waitForTerminal(child.runId);
    expect(getRun(child.runId)?.status).toBe('failed');
    expect(getRun(child.runId)?.errorCode).toBe('E_RESUME_NO_STAGED_FILES');
  });

  it('returns a named 409 from the resume route when the parent has no staged directory', async () => {
    setExecutor(async () => {
      throw new Error('E_TEST_PARENT_FAILED');
    });
    const parent = await createRun({
      brief: 'resume route refusal fixture',
      preset: 'docs',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      idempotencyKey: 'resume-route-key-0001',
    });
    await waitForTerminal(parent.runId);
    const app = await buildApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/runs/${parent.runId}/resume`,
        headers: { host: `127.0.0.1:${config.port}`, 'idempotency-key': 'resume-route-request-0001', 'content-type': 'application/json' },
        payload: {},
      });
      expect(response.statusCode).toBe(409);
      expect((response.json() as { error: { code: string } }).error.code).toBe('E_RESUME_NO_STAGED_FILES');
    } finally {
      await app.close();
    }
  });
});

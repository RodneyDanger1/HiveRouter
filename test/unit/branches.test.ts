import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  GitBranchError,
  createIsolationBranch,
  isolationBranchName,
  listBranches,
} from '../../src/server/git/branches.js';

const cleanup: string[] = [];

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function makeRepo(): { dir: string; head: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-branches-'));
  cleanup.push(dir);
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.name', 'HiveRouter Test']);
  git(dir, ['config', 'user.email', 'test@hive.invalid']);
  fs.writeFileSync(path.join(dir, 'seed.txt'), 'seed\n', 'utf8');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'seed']);
  return { dir, head: git(dir, ['rev-parse', 'HEAD']) };
}

afterEach(() => {
  for (const dir of cleanup.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('run-workspace isolation branches', () => {
  it('creates a bounded metadata branch without checking it out or touching HEAD', async () => {
    const { dir, head } = makeRepo();
    const branch = await createIsolationBranch(dir, {
      runId: 'run_0123456789abcdef12',
      phase: 'verifying',
      failureCode: 'E_GATE_FAILED',
    });

    expect(branch).toBe(`failed/run_0123456789abcdef12/verifying-${head.slice(0, 12)}`);
    expect(branch.length).toBeLessThanOrEqual(200);
    expect(git(dir, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe('main');
    expect(git(dir, ['rev-parse', `${branch}^`])).toBe(head);
    const message = git(dir, ['log', '-1', '--format=%B', branch]);
    expect(message).toContain('run-id: run_0123456789abcdef12');
    expect(message).toContain('phase: verifying');
    expect(message).toContain('failure-code: E_GATE_FAILED');
    expect(message).toContain('metadata-only: true');
  });

  it('uses patchSha as the base and lists local branches', async () => {
    const { dir } = makeRepo();
    fs.appendFileSync(path.join(dir, 'seed.txt'), 'patch\n', 'utf8');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'failed patch']);
    const patch = git(dir, ['rev-parse', 'HEAD']);

    const branch = await createIsolationBranch(dir, {
      runId: 'run_abcdefabcdefabcdef01',
      phase: 'testing',
      failureCode: 'E_TEST_FAILED',
      patchSha: patch.slice(0, 12),
    });

    expect(branch).toBe(`failed/run_abcdefabcdefabcdef01/testing-${patch.slice(0, 12)}`);
    expect(git(dir, ['rev-parse', `${branch}^`])).toBe(patch);
    expect(git(dir, ['log', '-1', '--format=%B', branch])).toContain(`patch-sha: ${patch}`);

    const branches = await listBranches(dir);
    expect(branches).toContain('main');
    expect(branches).toContain(branch);
    expect(branches).toEqual([...branches].sort((a, b) => a.localeCompare(b)));
  });

  it('is idempotent for the same failed run and phase', async () => {
    const { dir } = makeRepo();
    const input = {
      runId: 'run_11111111111111111111',
      phase: 'generating',
      failureCode: 'E_GATE_FAILED',
    } as const;
    const first = await createIsolationBranch(dir, input);
    const second = await createIsolationBranch(dir, input);
    expect(second).toBe(first);
    const failed = (await listBranches(dir)).filter((branch) => branch.startsWith('failed/'));
    expect(failed).toEqual([first]);
  });

  it('rejects invalid run ids, phases, failure codes, patch shas, and oversized names', async () => {
    const { dir } = makeRepo();
    const base = { runId: 'run_0123456789abcdef12', phase: 'verifying', failureCode: 'E_GATE_FAILED' };

    await expect(createIsolationBranch(dir, { ...base, runId: 'run_bad/name' })).rejects.toMatchObject({
      code: 'E_INVALID_RUN_INPUT',
    });
    await expect(createIsolationBranch(dir, { ...base, phase: 'not-a-phase' })).rejects.toMatchObject({
      code: 'E_INVALID_RUN_INPUT',
    });
    await expect(createIsolationBranch(dir, { ...base, failureCode: 'gate failed' })).rejects.toMatchObject({
      code: 'E_INVALID_RUN_INPUT',
    });
    await expect(createIsolationBranch(dir, { ...base, patchSha: 'not-a-sha' })).rejects.toMatchObject({
      code: 'E_INVALID_RUN_INPUT',
    });
    await expect(
      createIsolationBranch(dir, { ...base, runId: `run_${'a'.repeat(90)}` }),
    ).rejects.toMatchObject({ code: 'E_INVALID_RUN_INPUT' });
    await expect(createIsolationBranch(dir, base)).resolves.toBeTypeOf('string');
  });

  it('rejects paths outside the supplied workspace and files', async () => {
    const { dir } = makeRepo();
    await expect(
      createIsolationBranch(path.join(dir, 'missing'), {
        runId: 'run_0123456789abcdef12',
        phase: 'verifying',
        failureCode: 'E_GATE_FAILED',
      }),
    ).rejects.toMatchObject({ code: 'E_UNSAFE_PATH' });

    const file = path.join(dir, 'seed.txt');
    await expect(
      createIsolationBranch(file, {
        runId: 'run_0123456789abcdef12',
        phase: 'verifying',
        failureCode: 'E_GATE_FAILED',
      }),
    ).rejects.toMatchObject({ code: 'E_UNSAFE_PATH' });
  });

  it('refuses a non-git directory with E_GIT_UNAVAILABLE', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-no-git-'));
    cleanup.push(dir);
    await expect(
      createIsolationBranch(dir, {
        runId: 'run_0123456789abcdef12',
        phase: 'verifying',
        failureCode: 'E_GATE_FAILED',
      }),
    ).rejects.toMatchObject({ code: 'E_GIT_UNAVAILABLE' });
    await expect(listBranches(dir)).rejects.toMatchObject({ code: 'E_GIT_UNAVAILABLE' });
  });

  it('refuses a nested directory inside a parent repository', async () => {
    const { dir } = makeRepo();
    const nested = path.join(dir, 'nested');
    fs.mkdirSync(nested);
    await expect(
      createIsolationBranch(nested, {
        runId: 'run_0123456789abcdef12',
        phase: 'verifying',
        failureCode: 'E_GATE_FAILED',
      }),
    ).rejects.toMatchObject({ code: 'E_GIT_UNAVAILABLE' });
  });

  it('rejects a patch commit that is not present in the workspace', async () => {
    const { dir } = makeRepo();
    await expect(
      createIsolationBranch(dir, {
        runId: 'run_0123456789abcdef12',
        phase: 'verifying',
        failureCode: 'E_GATE_FAILED',
        patchSha: 'deadbee',
      }),
    ).rejects.toBeInstanceOf(GitBranchError);
  });

  it('exposes the exact branch-name contract and rejects non-hex commit names', () => {
    expect(isolationBranchName('run_0123456789abcdef12', 'verifying', 'abcdef0123456789')).toBe(
      'failed/run_0123456789abcdef12/verifying-abcdef012345',
    );
    expect(() => isolationBranchName('run_0123456789abcdef12', 'verifying', 'not-a-sha')).toThrow(GitBranchError);
  });
});

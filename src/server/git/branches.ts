import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { RUN_PHASES } from '../../shared/types.js';

/**
 * Run-workspace isolation branches.
 *
 * This module is deliberately not connected to the HiveRouter source checkout.
 * It operates only on the workspace it is given, and only through fixed,
 * non-shell `git` invocations. A failed patch/gate is recorded as a branch:
 *
 *   failed/<run-id>/<phase>-<base-short-sha>
 *
 * The branch points at a metadata-only commit whose tree is the base commit's
 * tree. The working tree and the currently checked-out branch are never
 * changed. No merge, delete, reset, clean, push, or fetch operation exists.
 */

export type GitBranchErrorCode =
  | 'E_GIT_UNAVAILABLE'
  | 'E_UNSAFE_PATH'
  | 'E_INVALID_RUN_INPUT'
  | 'E_GIT_OPERATION_FAILED';

export class GitBranchError extends Error {
  constructor(
    public readonly code: GitBranchErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'GitBranchError';
  }
}

export interface CreateIsolationBranchInput {
  runId: string;
  phase: string;
  failureCode: string;
  /** Optional failed-patch commit. Must already exist in the run workspace. */
  patchSha?: string;
}

export const ISOLATION_BRANCH_PREFIX = 'failed/';
export const MAX_BRANCH_NAME_LENGTH = 200;
const MAX_RUN_ID_LENGTH = 80;
const MAX_FAILURE_CODE_LENGTH = 80;
const BRANCH_SUFFIX_LENGTH = 12;
const GIT_TIMEOUT_MS = 20_000;
const GIT_MAX_BUFFER = 1024 * 1024;

const RUN_ID_PATTERN = /^run_[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const FAILURE_CODE_PATTERN = /^E_[A-Z0-9][A-Z0-9_]{0,79}$/;
const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;
const PHASES = new Set<string>(RUN_PHASES);

interface GitResult {
  stdout: string;
  stderr: string;
  code: number;
}

function gitEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    // Never let ambient git variables redirect the command to another repo.
    if (key.startsWith('GIT_')) continue;
    env[key] = value;
  }
  env.GIT_TERMINAL_PROMPT = '0';
  return env;
}

function gitFailure(stderr: string, fallback: string): string {
  const detail = stderr.trim();
  return detail ? `${fallback}: ${detail}` : fallback;
}

/**
 * Invoke git with fixed argument arrays. `shell: false` is explicit and cwd is
 * always the validated workspace; no caller-controlled argument is a shell
 * command. The helper returns non-zero results only when `allowFailure` is set.
 */
function runGit(workspace: string, args: readonly string[], allowFailure = false): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      [...args],
      {
        cwd: workspace,
        shell: false,
        windowsHide: true,
        timeout: GIT_TIMEOUT_MS,
        maxBuffer: GIT_MAX_BUFFER,
        env: gitEnvironment(),
      },
      (error, stdout, stderr) => {
        const code =
          error && typeof error === 'object' && 'code' in error && typeof error.code === 'number'
            ? error.code
            : error
              ? 1
              : 0;
        if (error && !allowFailure) {
          reject(
            new GitBranchError(
              'E_GIT_OPERATION_FAILED',
              gitFailure(String(stderr), `git ${args[0] ?? ''} failed`),
              { cause: error },
            ),
          );
          return;
        }
        resolve({ stdout: String(stdout ?? ''), stderr: String(stderr ?? ''), code });
      },
    );
  });
}

function samePath(left: string, right: string): boolean {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/**
 * Resolve and validate the supplied workspace. A run workspace must be an
 * existing real directory, not a symlink, and not the source checkout. Throws
 * E_UNSAFE_PATH for caller/path mistakes before git is invoked.
 */
export function assertRunWorkspace(workspace: string): string {
  if (typeof workspace !== 'string' || workspace.trim().length === 0 || workspace.length > 1024) {
    throw new GitBranchError('E_UNSAFE_PATH', 'workspace must be a non-empty path');
  }
  if (workspace.includes('\0')) throw new GitBranchError('E_UNSAFE_PATH', 'workspace contains a null byte');
  if (!path.isAbsolute(workspace)) throw new GitBranchError('E_UNSAFE_PATH', 'workspace must be absolute');

  const resolved = path.resolve(workspace);
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(resolved);
  } catch (error) {
    throw new GitBranchError('E_UNSAFE_PATH', 'workspace does not exist', { cause: error });
  }
  if (stat.isSymbolicLink()) throw new GitBranchError('E_UNSAFE_PATH', 'workspace must not be a symlink');
  if (!stat.isDirectory()) throw new GitBranchError('E_UNSAFE_PATH', 'workspace must be a directory');

  const real = fs.realpathSync.native(resolved);
  if (samePath(real, path.parse(real).root)) throw new GitBranchError('E_UNSAFE_PATH', 'workspace must not be a filesystem root');
  if (samePath(real, process.cwd())) throw new GitBranchError('E_UNSAFE_PATH', 'source checkout is not a run workspace');
  return real;
}

async function assertGitWorkspace(workspace: string): Promise<string> {
  const real = assertRunWorkspace(workspace);
  const inside = await runGit(real, ['rev-parse', '--is-inside-work-tree'], true);
  if (inside.code !== 0 || inside.stdout.trim() !== 'true') {
    throw new GitBranchError('E_GIT_UNAVAILABLE', 'workspace is not a git repository');
  }
  const top = await runGit(real, ['rev-parse', '--show-toplevel'], true);
  if (top.code !== 0) throw new GitBranchError('E_GIT_UNAVAILABLE', 'workspace has no git top-level');
  const topPath = top.stdout.trim();
  if (!topPath) throw new GitBranchError('E_GIT_UNAVAILABLE', 'workspace has no git top-level');
  let topReal: string;
  try {
    topReal = fs.realpathSync.native(topPath);
  } catch {
    throw new GitBranchError('E_GIT_UNAVAILABLE', 'workspace has no usable git top-level');
  }
  // A nested directory inside another repository must not silently operate on
  // the parent repository. The supplied directory itself must be the worktree.
  if (!samePath(topReal, real)) {
    throw new GitBranchError('E_GIT_UNAVAILABLE', 'workspace is not its own git worktree');
  }
  return real;
}

function validateInput(input: CreateIsolationBranchInput): { runId: string; phase: string; failureCode: string; patchSha?: string } {
  if (!input || typeof input !== 'object') throw new GitBranchError('E_INVALID_RUN_INPUT', 'branch input is required');
  const { runId, phase, failureCode, patchSha } = input;
  if (typeof runId !== 'string' || !RUN_ID_PATTERN.test(runId) || runId.length > MAX_RUN_ID_LENGTH) {
    throw new GitBranchError('E_INVALID_RUN_INPUT', 'runId is not an allowed run id');
  }
  if (typeof phase !== 'string' || !PHASES.has(phase)) {
    throw new GitBranchError('E_INVALID_RUN_INPUT', 'phase is not an allowed run phase');
  }
  if (typeof failureCode !== 'string' || !FAILURE_CODE_PATTERN.test(failureCode) || failureCode.length > MAX_FAILURE_CODE_LENGTH) {
    throw new GitBranchError('E_INVALID_RUN_INPUT', 'failureCode is not an allowed E_* code');
  }
  if (patchSha !== undefined && (typeof patchSha !== 'string' || !SHA_PATTERN.test(patchSha))) {
    throw new GitBranchError('E_INVALID_RUN_INPUT', 'patchSha must be 7-40 hexadecimal characters');
  }
  return { runId, phase, failureCode, patchSha: patchSha?.toLowerCase() };
}

/**
 * Build the bounded, validated branch name. Exported so callers/tests can
 * assert the exact naming contract without invoking git.
 */
export function isolationBranchName(runId: string, phase: string, commitSha: string): string {
  const input = validateInput({ runId, phase, failureCode: 'E_GATE_FAILED' });
  const shortSha = commitSha.toLowerCase().slice(0, BRANCH_SUFFIX_LENGTH);
  if (!/^[0-9a-f]{7,12}$/.test(shortSha)) {
    throw new GitBranchError('E_INVALID_RUN_INPUT', 'commitSha must contain hexadecimal characters');
  }
  const branch = `${ISOLATION_BRANCH_PREFIX}${input.runId}/${phase}-${shortSha}`;
  if (branch.length > MAX_BRANCH_NAME_LENGTH) throw new GitBranchError('E_INVALID_RUN_INPUT', 'branch name exceeds the bounded length');
  return branch;
}

/**
 * Create (or return) the isolation branch for a failed run. Branch creation is
 * metadata-only and non-destructive: the current branch, index, and working
 * tree are unchanged. Returns the exact branch name.
 */
export async function createIsolationBranch(workspace: string, input: CreateIsolationBranchInput): Promise<string> {
  const validated = validateInput(input);
  const real = await assertGitWorkspace(workspace);

  const requestedBase = validated.patchSha ?? 'HEAD';
  const baseResult = await runGit(real, ['rev-parse', '--verify', '--quiet', `${requestedBase}^{commit}`], true);
  if (baseResult.code !== 0) {
    throw new GitBranchError(
      'E_GIT_OPERATION_FAILED',
      validated.patchSha ? 'patchSha does not resolve to a commit in this workspace' : 'workspace has no HEAD commit',
    );
  }
  const baseSha = baseResult.stdout.trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(baseSha)) throw new GitBranchError('E_GIT_OPERATION_FAILED', 'git returned an invalid base commit');
  const branch = isolationBranchName(validated.runId, validated.phase, baseSha);

  const exists = await runGit(real, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], true);
  if (exists.code === 0) return branch;
  if (exists.code !== 1) throw new GitBranchError('E_GIT_OPERATION_FAILED', 'unable to check whether the isolation branch exists');

  const treeResult = await runGit(real, ['rev-parse', `${baseSha}^{tree}`]);
  const tree = treeResult.stdout.trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(tree)) throw new GitBranchError('E_GIT_OPERATION_FAILED', 'git returned an invalid base tree');

  const metadata = [
    `isolation: failed ${validated.failureCode}`,
    '',
    `run-id: ${validated.runId}`,
    `phase: ${validated.phase}`,
    `failure-code: ${validated.failureCode}`,
    `patch-sha: ${baseSha}`,
    `patch-input: ${validated.patchSha ?? baseSha}`,
    `base-sha: ${baseSha}`,
    `workspace: ${path.basename(real)}`,
    'metadata-only: true',
  ].join('\n');

  const commitResult = await runGit(real, [
    '-c',
    'user.name=HiveRouter',
    '-c',
    'user.email=hive-router@localhost',
    'commit-tree',
    tree,
    '-p',
    baseSha,
    '-m',
    metadata,
  ]);
  const commit = commitResult.stdout.trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new GitBranchError('E_GIT_OPERATION_FAILED', 'git returned an invalid metadata commit');

  // `git branch` is atomic: it refuses to overwrite an existing branch. The
  // short existence check above gives idempotency for repeated failure reports.
  const branchResult = await runGit(real, ['branch', '--no-track', branch, commit], true);
  if (branchResult.code !== 0) {
    const raced = await runGit(real, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], true);
    if (raced.code === 0) return branch;
    throw new GitBranchError('E_GIT_OPERATION_FAILED', gitFailure(branchResult.stderr, 'unable to create isolation branch'));
  }
  return branch;
}

/**
 * List local branches in the supplied run workspace. Remote-tracking refs are
 * deliberately excluded. The result is sorted by git ref order.
 */
export async function listBranches(workspace: string): Promise<string[]> {
  const real = await assertGitWorkspace(workspace);
  const result = await runGit(real, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']);
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .sort((a, b) => a.localeCompare(b));
}

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initDb, getDb } from '../../src/server/db/database.js';

let tempDir: string;

beforeEach(() => {
  closeDb();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-learning-cli-'));
});

afterEach(() => {
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('learn CLI refusal', () => {
  it('reports E_LEARNING_POOL_EXHAUSTED for six empty blocks, not a misleading sample refusal', () => {
    const dbPath = path.join(tempDir, 'hive.db');
    initDb(dbPath, 'B2');
    const db = getDb();
    for (let i = 0; i < 6; i += 1) {
      db.prepare(
        `INSERT INTO sealed_pool_blocks
         (block_id, status, dev_count, holdout_count, used_by_suite_id, created_at)
         VALUES (?, 'ready', 15, 50, NULL, ?)`,
      ).run(`empty-block-${i}`, new Date().toISOString());
    }
    closeDb();

    const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
    const args = process.platform === 'win32'
      ? ['/c', 'npx', 'tsx', 'scripts/learn.ts', '--json']
      : ['tsx', 'scripts/learn.ts', '--json'];
    let output = '';
    let exitCode = 0;
    try {
      output = execFileSync(command, args, {
        cwd: process.cwd(),
        env: { ...process.env, HIVE_DATA_DIR: tempDir, HIVE_PHASE: 'B2' },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      const failure = error as { stdout?: string; status?: number };
      output = failure.stdout ?? '';
      exitCode = failure.status ?? 1;
    }
    expect(exitCode).toBe(6);
    const start = output.indexOf('{');
    const end = output.lastIndexOf('}');
    const parsed = JSON.parse(output.slice(start, end + 1)) as {
      refused: { code: string } | null;
    };
    expect(parsed.refused?.code).toBe('E_LEARNING_POOL_EXHAUSTED');
  });
});

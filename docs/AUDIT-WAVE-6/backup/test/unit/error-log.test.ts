import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { recordCrash, recordError } from '../../src/server/observability/error-log.js';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-error-log-'));
  dirs.push(dir);
  return dir;
}

describe('durable error/crash logs', () => {
  it('writes redacted JSONL and never leaks a provided secret', () => {
    const dir = tempDir();
    const file = path.join(dir, 'errors.jsonl');
    recordError(
      {
        source: 'run',
        code: 'E_TEST',
        message: 'failed with sk-abcdefghijklmnopqrstuvwxyz123456',
        runId: 'run_log_test',
        context: { authorization: 'Bearer sk-abcdefghijklmnopqrstuvwxyz123456' },
      },
      { file },
    );
    const row = JSON.parse(fs.readFileSync(file, 'utf8').trim()) as Record<string, unknown>;
    expect(row.schema).toBe('hive.error.v1');
    expect(row.source).toBe('run');
    expect(row.code).toBe('E_TEST');
    expect(row.runId).toBe('run_log_test');
    expect(JSON.stringify(row)).not.toContain('sk-abcdefghijklmnopqrstuvwxyz123456');
    expect(JSON.stringify(row)).toContain('[REDACTED_SYSTEM_SECRET]');
  });

  it('writes a human crash record plus structured error record', () => {
    const dir = tempDir();
    const crashFile = path.join(dir, 'crash.log');
    const errorFile = path.join(dir, 'errors.jsonl');
    recordCrash(
      { source: 'crash', code: 'E_CRASH', message: 'boom', stack: 'Error: boom\n    at test', runId: null },
      { crashFile, file: errorFile },
    );
    expect(fs.readFileSync(crashFile, 'utf8')).toContain('E_CRASH');
    expect(fs.readFileSync(crashFile, 'utf8')).toContain('Error: boom');
    expect(fs.readFileSync(errorFile, 'utf8')).toContain('"source":"crash"');
  });
});

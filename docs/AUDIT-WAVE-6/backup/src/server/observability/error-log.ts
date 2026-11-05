import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { redactString, redactValue } from '../security/redact.js';

export interface ErrorLogInput {
  source: 'http' | 'run' | 'executor' | 'crash' | 'startup' | 'shutdown';
  code?: string | null;
  message: string;
  runId?: string | null;
  route?: string | null;
  stack?: string | null;
  context?: Record<string, unknown>;
}

export interface ErrorLogOptions {
  file?: string;
  crashFile?: string;
}

function logsDir(): string {
  return path.join(config.dataDir, 'logs');
}

function rotateIfNeeded(file: string): void {
  try {
    if (fs.existsSync(file) && fs.statSync(file).size > 5 * 1024 * 1024) {
      fs.renameSync(file, `${file}.1`);
    }
  } catch {
    // Logging must never break the caller.
  }
}

function appendJsonLine(file: string, value: unknown): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    rotateIfNeeded(file);
    fs.appendFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
  } catch {
    // Observability is best-effort; never fail a request or run because a log
    // file is unavailable.
  }
}

function safeText(value: string, limit = 8_000): string {
  return redactString(value).slice(0, limit);
}

/** Append one redacted structured error record to the durable error log. */
export function recordError(input: ErrorLogInput, options: ErrorLogOptions = {}): void {
  const file = options.file ?? path.join(logsDir(), 'errors.jsonl');
  appendJsonLine(file, {
    schema: 'hive.error.v1',
    ts: new Date().toISOString(),
    level: input.source === 'crash' || input.source === 'startup' ? 'fatal' : 'error',
    source: input.source,
    code: input.code ?? 'E_INTERNAL',
    message: safeText(input.message, 2_000),
    runId: input.runId ?? null,
    route: input.route ?? null,
    stack: input.stack ? safeText(input.stack, 6_000) : null,
    context: redactValue(input.context ?? {}),
  });
}

/** Append a human-readable crash record and the structured counterpart. */
export function recordCrash(input: ErrorLogInput, options: ErrorLogOptions = {}): void {
  const file = options.crashFile ?? path.join(logsDir(), 'crash.log');
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    rotateIfNeeded(file);
    fs.appendFileSync(
      file,
      `\n[${new Date().toISOString()}] ${input.source} ${input.code ?? 'E_INTERNAL'} ${input.runId ?? ''}\n${safeText(input.message, 2_000)}\n${input.stack ? safeText(input.stack, 8_000) : ''}\n`,
      'utf8',
    );
  } catch {
    // best-effort only
  }
  recordError({ ...input, source: input.source === 'crash' ? 'crash' : input.source }, options);
}

export { logsDir };

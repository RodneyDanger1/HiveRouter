import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RESERVED_EVENT_TYPES,
  RUN_EVENT_TYPES,
  STREAM_EVENT_TYPES,
  normaliseStreamEvent,
} from '../../src/shared/run-events.js';

const SERVER_ROOT = path.resolve(process.cwd(), 'src/server');

function walkTypeScript(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTypeScript(full));
    else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

function splitTopLevelArgs(call: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let quote: string | null = null;
  for (let index = 0; index < call.length; index += 1) {
    const char = call[index];
    if (quote) {
      if (char === '\\') {
        index += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(' || char === '[' || char === '{') depth += 1;
    else if (char === ')' || char === ']' || char === '}') depth -= 1;
    else if (char === ',' && depth === 0) {
      parts.push(call.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(call.slice(start));
  return parts;
}

function splitTernary(expression: string): { whenTrue: string; whenFalse: string } | null {
  let quote: string | null = null;
  let depth = 0;
  let question = -1;
  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    if (quote) {
      if (char === '\\') {
        index += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(' || char === '[' || char === '{') depth += 1;
    else if (char === ')' || char === ']' || char === '}') depth -= 1;
    else if (char === '?' && depth === 0) {
      question = index;
      break;
    }
  }
  if (question < 0) return null;
  quote = null;
  depth = 0;
  for (let index = question + 1; index < expression.length; index += 1) {
    const char = expression[index];
    if (quote) {
      if (char === '\\') {
        index += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(' || char === '[' || char === '{') depth += 1;
    else if (char === ')' || char === ']' || char === '}') depth -= 1;
    else if (char === ':' && depth === 0) {
      return { whenTrue: expression.slice(question + 1, index), whenFalse: expression.slice(index + 1) };
    }
  }
  return null;
}

function resolveTypeExpression(expression: string, location: string): string[] {
  const trimmed = expression.trim();
  const literal = /^(['"])([^'"]+)\1$/.exec(trimmed);
  if (literal) return [literal[2]];
  const ternary = splitTernary(trimmed);
  if (ternary) {
    return [
      ...resolveTypeExpression(ternary.whenTrue, location),
      ...resolveTypeExpression(ternary.whenFalse, location),
    ];
  }
  throw new Error(`${location}: cannot statically resolve emitEvent type expression "${trimmed}"`);
}

function emittedEventTypes(): Array<{ type: string; location: string }> {
  const found: Array<{ type: string; location: string }> = [];
  for (const file of walkTypeScript(SERVER_ROOT)) {
    const source = fs.readFileSync(file, 'utf8');
    const needle = 'emitEvent(';
    let index = source.indexOf(needle);
    while (index >= 0) {
      const open = index + needle.length - 1;
      let depth = 0;
      let quote: string | null = null;
      let end = -1;
      for (let cursor = open; cursor < source.length; cursor += 1) {
        const char = source[cursor];
        if (quote) {
          if (char === '\\') {
            cursor += 1;
            continue;
          }
          if (char === quote) quote = null;
          continue;
        }
        if (char === "'" || char === '"' || char === '`') {
          quote = char;
          continue;
        }
        if (char === '(') depth += 1;
        else if (char === ')') {
          depth -= 1;
          if (depth === 0) {
            end = cursor;
            break;
          }
        }
      }
      if (end < 0) throw new Error(`${path.relative(SERVER_ROOT, file)}: unterminated emitEvent call`);
      const line = source.slice(0, index).split('\n').length;
      const location = `${path.relative(SERVER_ROOT, file)}:${line}`;
      const args = splitTopLevelArgs(source.slice(open + 1, end));
      const typeExpression = args[1];
      if (typeExpression === undefined) throw new Error(`${location}: emitEvent without a type argument`);
      if (!/^type\s*:/.test(typeExpression.trim())) {
        for (const type of resolveTypeExpression(typeExpression, location)) found.push({ type, location });
      }
      index = source.indexOf(needle, end);
    }
  }
  return found;
}

describe('AF-02 event vocabulary contract', () => {
  it('registers every emitEvent type literal the server writes, including the ternary', () => {
    const found = emittedEventTypes();
    const emitted = new Set(found.map((entry) => entry.type));
    expect(emitted.size).toBeGreaterThanOrEqual(16);
    // Both branches of run.ts's `status === 'cancelled' ? ... : ...` are seen.
    expect(emitted.has('run.cancelled')).toBe(true);
    expect(emitted.has('run.failed')).toBe(true);

    const missingFromRegistry = found
      .filter((entry) => !(RUN_EVENT_TYPES as readonly string[]).includes(entry.type))
      .map((entry) => `${entry.location} ${entry.type}`);
    expect(missingFromRegistry).toEqual([]);

    const declaredButNeverEmitted = (RUN_EVENT_TYPES as readonly string[]).filter((type) => !emitted.has(type));
    expect(declaredButNeverEmitted).toEqual([]);
  });

  it('streams every declared emitted type and keeps the reserved listeners without duplicates', () => {
    for (const type of RUN_EVENT_TYPES) expect(STREAM_EVENT_TYPES).toContain(type);
    expect(new Set(STREAM_EVENT_TYPES).size).toBe(STREAM_EVENT_TYPES.length);
    expect(RESERVED_EVENT_TYPES).toHaveLength(16);
    expect(RESERVED_EVENT_TYPES as readonly string[]).toContain('heartbeat');
    for (const type of RESERVED_EVENT_TYPES) expect(STREAM_EVENT_TYPES).toContain(type);
  });

  it('pins the five event types the old client silently dropped', () => {
    for (const type of ['run.queued', 'agent.failed', 'phase.skipped', 'context.skipped', 'repair.stalled']) {
      expect(STREAM_EVENT_TYPES).toContain(type);
    }
  });

  it('wires the client to the shared vocabulary instead of a local list', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'web/src/hooks/useApi.ts'), 'utf8');
    expect(source).toContain("from '@shared/run-events'");
    expect(source).toContain('normaliseStreamEvent(');
    expect(source).not.toMatch(/const STREAM_EVENT_TYPES\s*=/);
  });

  it('unwraps the SSE envelope to the same inner payload the persisted mapper uses', () => {
    expect(
      normaliseStreamEvent('agent.failed', {
        schema: 'hive.api.v1',
        type: 'agent.failed',
        data: { code: 'E_LLM_RATE_LIMIT' },
        meta: { seq: 1 },
      }),
    ).toEqual({ type: 'agent.failed', data: { code: 'E_LLM_RATE_LIMIT' } });
  });

  it('does not unwrap a payload that merely contains data (no schema marker)', () => {
    const payload = { type: 'spoofed', data: { code: 'E_INTERNAL' } };
    expect(normaliseStreamEvent('run.started', payload)).toEqual({ type: 'run.started', data: payload });
  });

  it('returns non-record input unchanged and never throws', () => {
    expect(normaliseStreamEvent('message', 'raw text')).toEqual({ type: 'message', data: 'raw text' });
    expect(normaliseStreamEvent('message', null)).toEqual({ type: 'message', data: null });
    expect(normaliseStreamEvent('message', [1, 2])).toEqual({ type: 'message', data: [1, 2] });
  });

  it('keeps the frame name when the envelope type is not a string', () => {
    expect(normaliseStreamEvent('run.started', { schema: 'hive.api.v1', type: 7, data: { ok: true } })).toEqual({
      type: 'run.started',
      data: { ok: true },
    });
  });
});

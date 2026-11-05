import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import { closeDb, initDb } from '../../src/server/db/database.js';
import { config } from '../../src/server/config.js';

let app: Awaited<ReturnType<typeof buildApp>>;
const host = `127.0.0.1:${config.port}`;

function scorecard(specialist: string, architecture: number, risk: number, testability: number, clarity: number) {
  return { specialist, architecture, risk, testability, clarity, evidenceRefs: [`ref:${specialist}`] };
}

beforeAll(async () => {
  initDb(':memory:', 'B2');
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  closeDb();
});

describe('static analysis API', () => {
  it('describes its bounded, non-executing semantics', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/analysis', headers: { host } });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { operations: string[]; semantics: { dominators: string; scorecards: string } };
    expect(body.operations).toEqual(['dominators', 'scorecards']);
    expect(body.semantics.dominators).toContain('not a CFG');
    expect(body.semantics.scorecards).toContain('not a verdict');
  });

  it('computes a static dominator analysis over a bounded graph', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/analysis/dominators',
      headers: { host, 'content-type': 'application/json' },
      payload: { root: 'a.ts', edges: [{ from: 'a.ts', to: 'b.ts' }, { from: 'b.ts', to: 'c.ts' }] },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { ok: boolean; analysis: { analysis: string; dynamic: boolean; cfg: boolean; dominatedCounts: Record<string, number>; risk: Record<string, number> } };
    expect(body.ok).toBe(true);
    expect(body.analysis.analysis).toBe('static-file-dominators');
    expect(body.analysis.dynamic).toBe(false);
    expect(body.analysis.cfg).toBe(false);
    expect(body.analysis.dominatedCounts['b.ts']).toBe(1);
    expect(body.analysis.risk['a.ts']).toBeGreaterThan(0);
  });

  it('refuses an invalid graph with a named 422', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/analysis/dominators',
      headers: { host, 'content-type': 'application/json' },
      payload: { root: '', edges: [] },
    });
    expect(response.statusCode).toBe(422);
    expect((response.json() as { error: { code: string } }).error.code).toBe('E_ANALYSIS_INVALID_INPUT');
  });

  it('returns scorecard variance as a debate hint, not a verdict', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/analysis/scorecards',
      headers: { host, 'content-type': 'application/json' },
      payload: {
        scorecards: [
          scorecard('architect', 5, 4, 4, 5),
          scorecard('risk-auditor', 2, 5, 3, 3),
        ],
        threshold: 1.5,
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { ok: boolean; result: { variance: number; needsDebate: boolean; missing: string[] } };
    expect(body.ok).toBe(true);
    expect(body.result.variance).toBe(3);
    expect(body.result.needsDebate).toBe(true);
    expect(body.result.missing).toContain('testability-engineer');
  });

  it('refuses out-of-range scorecards instead of inventing consensus', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/analysis/scorecards',
      headers: { host, 'content-type': 'application/json' },
      payload: { scorecards: [{ ...scorecard('architect', 6, 4, 4, 5) }] },
    });
    expect(response.statusCode).toBe(422);
    expect((response.json() as { error: { code: string } }).error.code).toBe('E_ANALYSIS_INVALID_INPUT');
  });
});

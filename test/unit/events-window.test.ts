import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import { config } from '../../src/server/config.js';
import { closeDb, initDb } from '../../src/server/db/database.js';
import { createRunRow, emitEvent } from '../../src/server/runs/recorder.js';

const HOST = `127.0.0.1:${config.port}`;

let app: Awaited<ReturnType<typeof buildApp>>;
let savedWindow = 500;

function seedRun(runId: string): string {
  createRunRow({
    id: runId,
    brief: 'events window test',
    preset: 'docs',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: path.join(config.workspaceDir, 'runs', runId),
  });
  return runId;
}

function emitMany(runId: string, count: number): number[] {
  const seqs: number[] = [];
  for (let index = 0; index < count; index += 1) {
    seqs.push(emitEvent(runId, 'phase.started', { phase: 'planning', index }).seq);
  }
  return seqs;
}

async function fetchEvents(runId: string, after?: string) {
  const query = after === undefined ? '' : `?after=${encodeURIComponent(after)}`;
  const response = await app.inject({ method: 'GET', url: `/api/runs/${runId}/events${query}`, headers: { host: HOST } });
  expect(response.statusCode).toBe(200);
  const body = response.json() as { events: Array<{ seq: number }>; truncated: boolean; lastEventId: number };
  expect(Object.keys(body).sort()).toEqual(['events', 'lastEventId', 'truncated']);
  return body;
}

let zeroSeqs: number[] = [];
let twoSeqs: number[] = [];
let threeSeqs: number[] = [];
let fourSeqs: number[] = [];
let fiveSeqs: number[] = [];

beforeAll(async () => {
  initDb(':memory:', 'B2');
  seedRun('run_events_zero');
  seedRun('run_events_four');
  seedRun('run_events_three');
  seedRun('run_events_two');
  seedRun('run_events_five');
  zeroSeqs = emitMany('run_events_zero', 0);
  fourSeqs = emitMany('run_events_four', 4);
  threeSeqs = emitMany('run_events_three', 3);
  twoSeqs = emitMany('run_events_two', 2);
  fiveSeqs = emitMany('run_events_five', 5);
  savedWindow = config.limits.eventReplayWindow;
  (config.limits as unknown as { eventReplayWindow: number }).eventReplayWindow = 3;
  app = await buildApp();
});

afterAll(async () => {
  (config.limits as unknown as { eventReplayWindow: number }).eventReplayWindow = savedWindow;
  await app.close();
  closeDb();
});

describe('AF-04 /events window and truncation', () => {
  it('returns no rows and no truncation for a run with zero events', async () => {
    const body = await fetchEvents('run_events_zero');
    expect(zeroSeqs).toHaveLength(0);
    expect(body.events).toHaveLength(0);
    expect(body.truncated).toBe(false);
    expect(body.lastEventId).toBe(0);
  });

  it('returns all rows and no truncation for a shorter than window run', async () => {
    const body = await fetchEvents('run_events_two');
    expect(twoSeqs).toHaveLength(2);
    expect(body.events.map((event) => event.seq)).toEqual(twoSeqs);
    expect(body.truncated).toBe(false);
    expect(body.lastEventId).toBe(twoSeqs[1]);
  });

  it('returns all rows and no truncation for a run with exactly window events', async () => {
    const body = await fetchEvents('run_events_three');
    expect(threeSeqs).toHaveLength(3);
    expect(body.events.map((event) => event.seq)).toEqual(threeSeqs);
    expect(body.truncated).toBe(false);
    expect(body.lastEventId).toBe(threeSeqs[2]);
  });

  it('returns the newest window rows and truncation for a run with window+1 events', async () => {
    const body = await fetchEvents('run_events_four');
    const newestThree = fourSeqs.slice(-3);
    expect(body.events.map((event) => event.seq)).toEqual(newestThree);
    expect(body.truncated).toBe(true);
    expect(body.lastEventId).toBe(newestThree[2]);
  });

  it('applies the after cursor inside this run and flags a dropped event', async () => {
    const body = await fetchEvents('run_events_five', String(fiveSeqs[0]));
    const newestThreeAfterCursor = fiveSeqs.slice(-3);
    expect(body.events.map((event) => event.seq)).toEqual(newestThreeAfterCursor);
    expect(body.truncated).toBe(true);
    expect(body.lastEventId).toBe(fiveSeqs[4]);
  });

  it('returns an empty replay at the current last seq', async () => {
    const body = await fetchEvents('run_events_four', String(fourSeqs[3]));
    expect(body.events).toEqual([]);
    expect(body.truncated).toBe(false);
    expect(body.lastEventId).toBe(fourSeqs[3]);
  });

  it('clamps negative and NaN after values to zero', async () => {
    const negative = await fetchEvents('run_events_two', '-5');
    expect(negative.events.map((event) => event.seq)).toEqual(twoSeqs);
    expect(negative.truncated).toBe(false);
    const nan = await fetchEvents('run_events_two', 'NaN');
    expect(nan.events.map((event) => event.seq)).toEqual(twoSeqs);
    expect(nan.truncated).toBe(false);
  });

  it('keeps the unknown-run refusal unchanged', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/runs/run_events_missing/events', headers: { host: HOST } });
    expect(response.statusCode).toBe(404);
    expect((response.json() as { error: { code: string } }).error.code).toBe('E_RUN_NOT_FOUND');
  });
});

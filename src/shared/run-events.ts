export interface PersistedRunEventRow {
  type?: unknown;
  payload?: unknown;
  data?: unknown;
  createdAt?: unknown;
}

export interface MappedRunEvent {
  type: string;
  data: unknown;
  receivedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The authoritative set of event types the server writes through emitEvent.
 * Every member is subscribed by the client; the static contract test keeps this
 * list and the src/server emit sites in lockstep. The set grows only through an
 * explicit, approved event addition (run.interrupted is the AF-07 addition).
 */
export const RUN_EVENT_TYPES = [
  'run.queued',
  'run.started',
  'run.failed',
  'run.cancelled',
  'run.completed',
  'phase.started',
  'phase.completed',
  'phase.skipped',
  'agent.started',
  'agent.completed',
  'agent.failed',
  'file.written',
  'route.decided',
  'context.packed',
  'context.skipped',
  'repair.stalled',
  'run.interrupted',
] as const;

/**
 * Names the client historically subscribed to that no server code emits today.
 * They are retained deliberately (future surface, not a claim) so the client
 * never silently loses a listener; the static test pins them as a set.
 */
export const RESERVED_EVENT_TYPES = [
  'run.updated',
  'run.paused',
  'run.needs_review',
  'step.started',
  'step.completed',
  'agent.delta',
  'file.revised',
  'check.completed',
  'review.completed',
  'failure.clustered',
  'repair.completed',
  'confidence.recorded',
  'learning.trace',
  'learning.eval',
  'learning.promotion',
  'heartbeat',
] as const;

/** Every name the client registers a listener for. */
export const STREAM_EVENT_TYPES: readonly string[] = [...RUN_EVENT_TYPES, ...RESERVED_EVENT_TYPES];

/**
 * Normalises one SSE frame into the same shape the persisted /events mapper
 * produces. Only a record carrying the hive.api.v1 schema marker with an inner
 * `data` property is unwrapped; a payload that merely contains a `data` key is
 * returned untouched (anti-spoofing).
 */
export function normaliseStreamEvent(rawType: string, rawData: unknown): { type: string; data: unknown } {
  if (isRecord(rawData) && rawData.schema === 'hive.api.v1' && 'data' in rawData) {
    return {
      type: typeof rawData.type === 'string' ? rawData.type : rawType,
      data: rawData.data,
    };
  }
  return { type: rawType, data: rawData };
}

/**
 * Chooses the array the Events tab renders. A terminal run must show the
 * persisted /events ledger (the server window), never a stale in-memory live
 * buffer that is capped at 100 and missing previously unsubscribed types. A
 * non-terminal run keeps its live buffer. Pure: no array is mutated.
 */
export function selectVisibleEvents(input: {
  terminal: boolean;
  live: MappedRunEvent[];
  persisted: MappedRunEvent[];
}): MappedRunEvent[] {
  return input.terminal ? input.persisted : input.live;
}

/** Maps persisted GET /events rows to the same shape the SSE client consumes. */
export function mapPersistedRunEvents(rows: unknown[]): MappedRunEvent[] {
  return rows.filter(isRecord).map((row) => ({
    type: typeof row.type === 'string' ? row.type : 'run.event',
    data: row.payload ?? row.data ?? null,
    receivedAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(0).toISOString(),
  }));
}

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

/** Maps persisted GET /events rows to the same shape the SSE client consumes. */
export function mapPersistedRunEvents(rows: unknown[]): MappedRunEvent[] {
  return rows.filter(isRecord).map((row) => ({
    type: typeof row.type === 'string' ? row.type : 'run.event',
    data: row.payload ?? row.data ?? null,
    receivedAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(0).toISOString(),
  }));
}

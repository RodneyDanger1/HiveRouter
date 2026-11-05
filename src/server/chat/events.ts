import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { getDb, nowIso } from '../db/database.js';
import { redactValue } from '../security/redact.js';
import type { ChatEventRecord, ChatEventType } from '../../shared/chat.js';

const emitter = new EventEmitter();
emitter.setMaxListeners(200);

function id(): string {
  return `chev_${crypto.randomBytes(9).toString('hex')}`;
}

/** Insert one durable projection event inside an existing transaction. */
export function appendChatEvent(
  db: ReturnType<typeof getDb>,
  threadId: string,
  type: ChatEventType,
  payload: Record<string, unknown> = {},
): ChatEventRecord {
  const safe = redactValue(payload) as Record<string, unknown>;
  const createdAt = nowIso();
  const info = db
    .prepare('INSERT INTO chat_events (thread_id, type, payload_json, created_at) VALUES (?, ?, ?, ?)')
    .run(threadId, type, JSON.stringify(safe), createdAt);
  return {
    seq: Number(info.lastInsertRowid),
    threadId,
    type,
    payload: safe,
    createdAt,
  };
}

/** Notify live subscribers after a transaction commits. */
export function publishChatEvents(events: readonly ChatEventRecord[]): void {
  for (const event of events) emitter.emit(event.threadId, event);
}

export function subscribeChat(threadId: string, listener: (event: ChatEventRecord) => void): () => void {
  emitter.on(threadId, listener);
  return () => emitter.off(threadId, listener);
}

export function getChatEvents(threadId: string, after = 0, limit = 500): ChatEventRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT seq, thread_id, type, payload_json, created_at
       FROM chat_events WHERE thread_id = ? AND seq > ? ORDER BY seq ASC LIMIT ?`,
    )
    .all(threadId, after, limit) as Array<{
    seq: number;
    thread_id: string;
    type: string;
    payload_json: string;
    created_at: string;
  }>;
  return rows.map((row) => ({
    seq: Number(row.seq),
    threadId: row.thread_id,
    type: row.type as ChatEventType,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    createdAt: row.created_at,
  }));
}

export function countChatEventsAfter(threadId: string, after: number): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS n FROM chat_events WHERE thread_id = ? AND seq > ?')
    .get(threadId, after) as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

export function lastChatEventSeq(threadId: string): number {
  const row = getDb()
    .prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM chat_events WHERE thread_id = ?')
    .get(threadId) as { seq: number } | undefined;
  return Number(row?.seq ?? 0);
}

export function chatEventId(): string {
  return id();
}

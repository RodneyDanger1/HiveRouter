import { useEffect, useRef, useState } from 'react';
import type { ChatEventRecord } from '@shared/chat';

export type ChatStreamStatus = 'connecting' | 'live' | 'reconnecting' | 'closed';

/**
 * Live projection for one chat thread. The server emits unnamed SSE messages
 * with the persisted event envelope; EventSource carries Last-Event-ID on
 * reconnect so the API can replay only the missing durable events.
 */
export function useChatStream(
  threadId: string | null,
  onEvent: (event: ChatEventRecord) => void,
): ChatStreamStatus {
  const [status, setStatus] = useState<ChatStreamStatus>('connecting');
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!threadId || typeof EventSource === 'undefined') {
      setStatus('closed');
      return;
    }
    const source = new EventSource(`/api/chat/threads/${encodeURIComponent(threadId)}/stream`);
    let active = true;
    setStatus('connecting');
    const handler = (rawEvent: Event) => {
      const event = rawEvent as MessageEvent<string>;
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data) as unknown;
      } catch {
        return;
      }
      if (typeof parsed !== 'object' || parsed === null) return;
      const record = parsed as Record<string, unknown>;
      const type = typeof record.type === 'string' ? record.type : '';
      const seq = typeof record.seq === 'number' ? record.seq : 0;
      const data = typeof record.data === 'object' && record.data !== null ? record.data : {};
      const createdAt = new Date().toISOString();
      onEventRef.current({
        seq,
        threadId,
        type: type as ChatEventRecord['type'],
        payload: data as Record<string, unknown>,
        createdAt,
      });
    };
    source.onmessage = handler;
    source.onopen = () => {
      if (active) setStatus('live');
    };
    source.onerror = () => {
      if (active) setStatus('reconnecting');
    };
    return () => {
      active = false;
      source.close();
      setStatus('closed');
    };
  }, [threadId]);

  return status;
}

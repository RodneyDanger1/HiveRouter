import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, isAbortError } from '../api';
import { normaliseStreamEvent, STREAM_EVENT_TYPES } from '@shared/run-events';
import type { RunStreamEvent } from '../api-types';

export interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

export interface ApiResource<T> extends ResourceState<T> {
  reload: () => void;
}

export function useApiResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
): ApiResource<T> {
  const [state, setState] = useState<ResourceState<T>>({ data: null, loading: true, error: null });
  const [nonce, setNonce] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let retriedNetwork = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    loaderRef.current(controller.signal).then(
      (data) => {
        if (active) setState({ data, loading: false, error: null });
      },
      (error: unknown) => {
        if (!active || isAbortError(error)) return;
        const normalized =
          error instanceof ApiError
            ? error
            : new ApiError({
                code: 'E_NETWORK',
                status: 0,
                message: error instanceof Error ? error.message : 'The request failed.',
              });
        // A server restart or a transient loopback hiccup should recover once
        // without making the user hunt for the Retry button. A real outage
        // still surfaces the named error after the single retry.
        if (normalized.code === 'E_NETWORK' && !retriedNetwork) {
          retriedNetwork = true;
          retryTimer = setTimeout(() => {
            if (active) setNonce((value) => value + 1);
          }, 650);
          return;
        }
        setState((previous) => ({ data: previous.data, loading: false, error: normalized }));
      },
    );
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      controller.abort();
    };
    // The caller owns the dependency list; loader is read through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return { ...state, reload };
}

export type StreamStatus = 'connecting' | 'live' | 'reconnecting' | 'closed';

export function useRunStream(
  runId: string | null,
  onEvent: (event: RunStreamEvent) => void,
): StreamStatus {
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!runId || typeof EventSource === 'undefined') {
      setStatus('closed');
      return;
    }

    const source = new EventSource(`/api/runs/${encodeURIComponent(runId)}/stream`);
    let active = true;
    setStatus('connecting');

    const handler = (rawEvent: Event) => {
      const event = rawEvent as MessageEvent<string>;
      let data: unknown = event.data;
      try {
        data = JSON.parse(event.data) as unknown;
      } catch {
        /* retain raw text */
      }
      const normalised = normaliseStreamEvent(event.type, data);
      if (normalised.type === 'heartbeat') return;
      onEventRef.current({
        type: normalised.type === 'message' ? 'run.event' : normalised.type,
        data: normalised.data,
        receivedAt: new Date().toISOString(),
      });
    };

    for (const type of STREAM_EVENT_TYPES) source.addEventListener(type, handler as EventListener);
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
  }, [runId]);

  return status;
}

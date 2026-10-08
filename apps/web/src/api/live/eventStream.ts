import type { ChangeEvent } from '@tracker/shared';
import { retryDelay } from './backoff';
import { parseChangeEvent } from './changeEvent';

// The server sends a `ping` event every 15 s. A stream that misses two is dead even when it still
// looks open, as when the dev proxy keeps the browser's side open after the API server crashes.
export const LIVE_STALE_MS = 35_000;

export interface LiveHandlers {
  onChange: (event: ChangeEvent) => void;
  onReconnect: () => void;
}

type Timer = ReturnType<typeof setTimeout> | undefined;

// EventSource retries network drops by itself but gives up for good on an HTTP error (a restarting
// server behind a proxy, or a 401 before sign-in), so a closed or silent stream is reopened here.
export function connectLiveUpdates(url: string, handlers: LiveHandlers): () => void {
  if (typeof EventSource === 'undefined') return () => undefined;
  let source: EventSource | undefined;
  let retry: Timer;
  let silence: Timer;
  let failedAttempts = 0;
  // Changes made while no stream was open are lost, including before a first connect that failed.
  let reconnecting = false;

  const stopTimers = () => {
    clearTimeout(retry);
    clearTimeout(silence);
  };
  const reopenLater = () => {
    source?.close();
    stopTimers();
    reconnecting = true;
    retry = setTimeout(connect, retryDelay(failedAttempts));
    failedAttempts += 1;
  };
  const alive = () => {
    clearTimeout(silence);
    silence = setTimeout(reopenLater, LIVE_STALE_MS);
  };
  const onOpen = () => {
    alive();
    failedAttempts = 0;
    if (reconnecting) handlers.onReconnect();
    reconnecting = false;
  };
  const onMessage = (message: MessageEvent) => {
    alive();
    const event = parseChangeEvent(message.data);
    if (event) handlers.onChange(event);
  };
  const onError = () => {
    reconnecting = true;
    if (source?.readyState === EventSource.CLOSED) reopenLater();
  };
  function connect() {
    source = new EventSource(url);
    source.addEventListener('open', onOpen);
    source.addEventListener('message', onMessage);
    source.addEventListener('changed', onMessage);
    source.addEventListener('ping', alive);
    source.addEventListener('error', onError);
    alive();
  }

  connect();
  return () => {
    stopTimers();
    source?.close();
  };
}

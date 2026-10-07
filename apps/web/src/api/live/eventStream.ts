import type { ChangeEvent } from '@tracker/shared';
import { parseChangeEvent } from './changeEvent';

export const LIVE_RETRY_MS = 5_000;

export interface LiveHandlers {
  onChange: (event: ChangeEvent) => void;
  onReconnect: () => void;
}

// EventSource retries network drops by itself but gives up for good on an HTTP error
// (a restarting server behind a proxy, or a 401 before sign-in), so reopen it after a pause.
export function connectLiveUpdates(url: string, handlers: LiveHandlers): () => void {
  if (typeof EventSource === 'undefined') return () => undefined;
  let source: EventSource | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let connectedBefore = false;

  const onMessage = (message: MessageEvent) => {
    const event = parseChangeEvent(message.data);
    if (event) handlers.onChange(event);
  };
  const onOpen = () => {
    if (connectedBefore) handlers.onReconnect();
    connectedBefore = true;
  };
  const onError = () => {
    if (source?.readyState !== EventSource.CLOSED) return;
    source.close();
    retry = setTimeout(connect, LIVE_RETRY_MS);
  };
  function connect() {
    source = new EventSource(url);
    source.addEventListener('open', onOpen);
    source.addEventListener('message', onMessage);
    source.addEventListener('changed', onMessage);
    source.addEventListener('error', onError);
  }

  connect();
  return () => {
    clearTimeout(retry);
    source?.close();
  };
}

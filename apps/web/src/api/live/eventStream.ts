import { LIVE_STALE_MS, type ChangeEvent } from '@tracker/shared';
import { retryDelay } from './backoff';
import { parseChangeEvent } from './changeEvent';
import { pauseWhileHidden } from './pauseWhileHidden';

export interface LiveHandlers {
  onChange: (event: ChangeEvent) => void;
  onReconnect: () => void;
  // While true, reads can wait for onReconnect: it runs once the stream reports every later change.
  onRefreshPending: (pending: boolean) => void;
  // EventSource hides the HTTP status, so a 401 for a lost session looks like a proxy's 502.
  onRefused: () => void;
}

type Timer = ReturnType<typeof setTimeout> | undefined;

// Reads wait for a reopening stream only while it is likely to open soon: behind a proxy that
// refuses the stream while the API answers, it never does, and focus would never read again.
export const LIVE_WAIT_ATTEMPTS = 3;

// EventSource retries network drops by itself but gives up for good on an HTTP error (a restarting
// server behind a proxy, or a 401 once the session is gone), so a closed or silent stream is
// reopened here.
export function connectLiveUpdates(url: string, handlers: LiveHandlers): () => void {
  if (typeof EventSource === 'undefined') return () => undefined;
  let source: EventSource | undefined;
  let retry: Timer;
  let silence: Timer;
  let failedAttempts = 0;
  // Changes made while no stream was open are lost, including before a first connect that failed.
  let reconnecting = false;
  const reportPending = () =>
    handlers.onRefreshPending(reconnecting && failedAttempts < LIVE_WAIT_ATTEMPTS);
  const setReconnecting = (value: boolean) => {
    reconnecting = value;
    reportPending();
  };

  const close = () => {
    source?.close();
    clearTimeout(retry);
    clearTimeout(silence);
    setReconnecting(true);
  };
  const reopenLater = () => {
    close();
    retry = setTimeout(connect, retryDelay(failedAttempts));
    failedAttempts += 1;
    reportPending();
  };
  const alive = () => {
    clearTimeout(silence);
    silence = setTimeout(reopenLater, LIVE_STALE_MS);
  };
  const onOpen = () => {
    alive();
    failedAttempts = 0;
    const missed = reconnecting;
    setReconnecting(false);
    if (missed) handlers.onReconnect();
  };
  const onMessage = (message: MessageEvent) => {
    alive();
    const event = parseChangeEvent(message.data);
    if (event) handlers.onChange(event);
  };
  const onError = () => {
    if (source?.readyState === EventSource.CLOSED) {
      reopenLater();
      handlers.onRefused();
      return;
    }
    // The browser tries a dropped stream again by itself, and each try that fails counts too.
    failedAttempts += 1;
    setReconnecting(true);
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
  // Resuming opens a new stream like any reconnect, so the page catches up on what it missed.
  const stopWatching = pauseWhileHidden({ pause: close, resume: connect });
  return () => {
    stopWatching();
    close();
    // A stopped stream never opens again, so nothing else would refresh the page.
    handlers.onRefreshPending(false);
  };
}

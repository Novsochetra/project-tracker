import {
  LIVE_STALE_MS,
  type ChangeEvent,
  type ChatDeletedEvent,
  type RunEvent,
  type RunRequestEvent,
  type RunStepEvent,
} from '@tracker/shared';
import { retryDelay } from './backoff';
import {
  parseChangeEvent,
  parseChatDeletedEvent,
  parseRunEvent,
  parseRunRequestEvent,
  parseRunStepEvent,
} from './changeEvent';
import { pauseWhileHidden } from './pauseWhileHidden';

export interface LiveHandlers {
  onChange: (event: ChangeEvent) => void;
  onRun: (event: RunEvent) => void;
  onRunStep: (event: RunStepEvent) => void;
  onRunRequest: (event: RunRequestEvent) => void;
  onChatDeleted: (event: ChatDeletedEvent) => void;
  onReconnect: () => void;
  // While true, reads can wait for onReconnect: it runs once the stream reports every later change.
  onRefreshPending: (pending: boolean) => void;
  // EventSource hides the HTTP status, so a 401 for a lost session looks like a proxy's 502.
  onRefused: () => void;
}

// The app's word on whether the tracker answers (app/reachability).
export interface TrackerReachability {
  isUnreachable: () => boolean;
  subscribe: (listener: () => void) => () => void;
}

type Timer = ReturnType<typeof setTimeout> | undefined;

const relay =
  <T>(alive: () => void, parse: (data: unknown) => T | null, deliver: (event: T) => void) =>
  (message: MessageEvent) => {
    alive();
    const event = parse(message.data);
    if (event) deliver(event);
  };

// Reads wait for a reopening stream only while it is likely to open soon: behind a proxy that
// refuses the stream while the API answers, it never does, and focus would never read again.
export const LIVE_WAIT_ATTEMPTS = 3;

// EventSource retries network drops by itself but gives up for good on an HTTP error (a restarting
// server behind a proxy, or a 401 once the session is gone), so a closed or silent stream is
// reopened here.
export function connectLiveUpdates(
  url: string,
  handlers: LiveHandlers,
  tracker?: TrackerReachability,
): () => void {
  if (typeof EventSource === 'undefined') return () => undefined;
  let source: EventSource | undefined;
  let retry: Timer;
  let silence: Timer;
  // The wait before the app's next reopening grows with its own reopenings only. The browser's own
  // tries count toward LIVE_WAIT_ATTEMPTS: counted into the wait too, an outage longer than the
  // silence check left 15 s before the app's first try.
  let reopenings = 0;
  let failedTries = 0;
  // Changes made while no stream was open are lost, including before a first connect that failed.
  let reconnecting = false;
  const reportPending = () =>
    handlers.onRefreshPending(reconnecting && failedTries < LIVE_WAIT_ATTEMPTS);
  const setReconnecting = (value: boolean) => {
    reconnecting = value;
    reportPending();
  };

  const cancelRetry = () => {
    clearTimeout(retry);
    retry = undefined;
  };
  const close = () => {
    source?.close();
    cancelRetry();
    clearTimeout(silence);
    setReconnecting(true);
  };
  const reopenLater = () => {
    close();
    retry = setTimeout(connect, retryDelay(reopenings));
    reopenings += 1;
    failedTries += 1;
    reportPending();
  };
  const alive = () => {
    clearTimeout(silence);
    silence = setTimeout(reopenLater, LIVE_STALE_MS);
  };
  const onOpen = () => {
    alive();
    reopenings = 0;
    failedTries = 0;
    const missed = reconnecting;
    setReconnecting(false);
    if (missed) handlers.onReconnect();
  };
  const onMessage = relay(alive, parseChangeEvent, handlers.onChange);
  const onRun = relay(alive, parseRunEvent, handlers.onRun);
  const onRunStep = relay(alive, parseRunStepEvent, handlers.onRunStep);
  const onRunRequest = relay(alive, parseRunRequestEvent, handlers.onRunRequest);
  const onChatDeleted = relay(alive, parseChatDeletedEvent, handlers.onChatDeleted);
  const onError = () => {
    if (source?.readyState === EventSource.CLOSED) {
      reopenLater();
      handlers.onRefused();
      return;
    }
    // The browser tries a dropped stream again by itself, and each try that fails counts too.
    failedTries += 1;
    setReconnecting(true);
  };
  function connect() {
    cancelRetry();
    source = new EventSource(url);
    source.addEventListener('open', onOpen);
    source.addEventListener('message', onMessage);
    source.addEventListener('changed', onMessage);
    source.addEventListener('run', onRun);
    source.addEventListener('run-step', onRunStep);
    source.addEventListener('run-request', onRunRequest);
    source.addEventListener('chat-deleted', onChatDeleted);
    source.addEventListener('ping', alive);
    source.addEventListener('error', onError);
    alive();
  }

  // The banner went within 3 s of the tracker answering again, but the screens' data waited for
  // the stream's next try, up to 15 s later (PT-118). Only a stream waiting for that try has a
  // retry timer: one that is open or on its way, one the browser retries itself and one paused
  // while hidden are left alone, so no second stream opens.
  const reopenNow = () => {
    if (retry === undefined || tracker?.isUnreachable()) return;
    reopenings = 0;
    connect();
  };

  connect();
  // Resuming opens a new stream like any reconnect, so the page catches up on what it missed.
  const stopWatching = pauseWhileHidden({ pause: close, resume: connect });
  const stopFollowing = tracker?.subscribe(reopenNow);
  return () => {
    stopWatching();
    stopFollowing?.();
    close();
    // A stopped stream never opens again, so nothing else would refresh the page.
    handlers.onRefreshPending(false);
  };
}

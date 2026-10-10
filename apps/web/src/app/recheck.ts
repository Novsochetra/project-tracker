import type { ReachabilityFlag } from './reachability';

// While the tracker can't be reached, only the live stream asked whether it was back, with tries
// up to 15 s apart, and the banner went up to about 26 s after the API answered again (PT-113).
// Asked 1 s, then 2 s, then 3 s after each check ends, it goes within 3 s; one small request at a
// time is no storm.
export const RECHECK_MS = 1_000;
export const RECHECK_MAX_MS = 3_000;

const recheckDelay = (rechecks: number): number =>
  Math.min(RECHECK_MS * 2 ** rechecks, RECHECK_MAX_MS);

// A hidden page shows no banner, and a phone's radio needn't wake for it.
const isHidden = (): boolean => document.visibilityState === 'hidden';

export function recheckWhileUnreachable(
  reachability: ReachabilityFlag,
  recheck: () => Promise<unknown>,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rechecks = 0;
  let running = false;
  let stopped = false;
  const due = () => !stopped && reachability.isUnreachable() && !isHidden();
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const ended = () => {
    running = false;
    schedule();
  };
  const run = () => {
    cancel();
    if (running || !due()) return;
    running = true;
    void recheck().then(ended, ended);
  };
  function schedule() {
    cancel();
    if (!due()) return;
    timer = setTimeout(run, recheckDelay(rechecks));
    rechecks += 1;
  }
  const startOver = () => {
    rechecks = 0;
    if (!running) schedule();
  };
  // Back on the page, the person wants to know now.
  const onVisibilityChange = () => {
    rechecks = 0;
    if (isHidden()) cancel();
    else run();
  };
  const stopListening = reachability.subscribe(startOver);
  document.addEventListener('visibilitychange', onVisibilityChange);
  // Started during an outage, as by a watcher made again for a new client, no change would start it.
  schedule();
  return () => {
    stopped = true;
    cancel();
    stopListening();
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}

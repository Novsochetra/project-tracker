// How long a push waits for its screen's code before it goes anyway, to the screen's own loading
// state (PT-104). The slowest load that worked, the Project screen on slow 3G beside the Ticket
// screen's code, took about 5 s; twice that leaves room for a worse network, and 10 s is also
// about as long as people keep their attention on a tap with nothing else happening. A chunk
// still on its way by then has most likely stalled, and the browser may take minutes to give up.
export const PUSH_WAIT_LIMIT_MS = 10_000;

// Settles once, when the code is in (or failed) or when the time is up, whichever comes first, so
// code that comes after the limit doesn't push a second time.
export function waitAtMost(waiting: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeUp = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  const settled = waiting.then(
    () => undefined,
    () => undefined,
  );
  return Promise.race([settled, timeUp]).finally(() => clearTimeout(timer));
}

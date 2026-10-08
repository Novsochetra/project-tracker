export const CLICK_GUARD_MS = 400;

let armedUntil = 0;

/** After a drag, the click the browser fires on release must not open the ticket. */
export function armClickGuard(now: number = performance.now()): void {
  armedUntil = now + CLICK_GUARD_MS;
}

/** True when this click follows a drag; only one click is swallowed. */
export function consumeClickGuard(now: number = performance.now()): boolean {
  const blocked = now < armedUntil;
  armedUntil = 0;
  return blocked;
}

export type PullDecision = 'wait' | 'engage' | 'ignore';

const DECIDE_AFTER = 3;

// Content that fits has nothing to scroll, so an upward drag is the panel's too (it stretches).
export function decidePull(dx: number, dy: number, scrollTop: number, fits = false): PullDecision {
  if (Math.abs(dx) < DECIDE_AFTER && Math.abs(dy) < DECIDE_AFTER) return 'wait';
  if (Math.abs(dy) < Math.abs(dx)) return 'ignore';
  return fits || (dy > 0 && scrollTop <= 0) ? 'engage' : 'ignore';
}

export function canScrollUpWithin(target: EventTarget | null, container: HTMLElement): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== container) {
    if (node.scrollTop > 0) return true;
    node = node.parentElement;
  }
  return false;
}

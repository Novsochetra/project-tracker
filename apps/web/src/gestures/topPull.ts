export type PullDecision = 'wait' | 'engage' | 'ignore';

const DECIDE_AFTER = 3;

export function decidePull(dx: number, dy: number, scrollTop: number): PullDecision {
  if (Math.abs(dx) < DECIDE_AFTER && Math.abs(dy) < DECIDE_AFTER) return 'wait';
  return dy > 0 && dy >= Math.abs(dx) && scrollTop <= 0 ? 'engage' : 'ignore';
}

export function canScrollUpWithin(target: EventTarget | null, container: HTMLElement): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== container) {
    if (node.scrollTop > 0) return true;
    node = node.parentElement;
  }
  return false;
}

const claimed = new Set<number>();

export const claimPointer = (pointerId: number): void => {
  claimed.add(pointerId);
};

export const releasePointer = (pointerId: number): void => {
  claimed.delete(pointerId);
};

export const isPointerClaimed = (pointerId: number): boolean => claimed.has(pointerId);

export const isNoSwipeTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest('[data-no-swipe]') !== null;

const TAP_CLICK_MS = 300;

export function swallowTapClick(pointerId: number): void {
  let timer: number | undefined;
  const block = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    cleanup();
  };
  const onUp = (event: PointerEvent) => {
    if (event.pointerId === pointerId) timer = window.setTimeout(cleanup, TAP_CLICK_MS);
  };
  const onCancel = (event: PointerEvent) => {
    if (event.pointerId === pointerId) cleanup();
  };
  function cleanup() {
    window.clearTimeout(timer);
    window.removeEventListener('click', block, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onCancel, true);
  }
  window.addEventListener('click', block, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onCancel, true);
}

// A mouse or pen drag that ends over its start element fires a click in the same task as the
// pointerup (touch drags don't); only that one is swallowed, so a quick real tap still works.
export function suppressNextClick(): void {
  const block = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    cleanup();
  };
  const timer = window.setTimeout(() => cleanup(), 0);
  function cleanup() {
    window.clearTimeout(timer);
    window.removeEventListener('click', block, true);
  }
  window.addEventListener('click', block, true);
}

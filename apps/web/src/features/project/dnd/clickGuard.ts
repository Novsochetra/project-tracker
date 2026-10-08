let armed = false;

// After a drag, the click the browser fires on release must not open the ticket. It comes in the
// same task as the pointerup, after the drop re-rendered however long that took, so the guard
// lasts until that task ends instead of a fixed time.
export function armClickGuard(): void {
  armed = true;
  setTimeout(() => {
    armed = false;
  }, 0);
}

export function consumeClickGuard(): boolean {
  const blocked = armed;
  armed = false;
  return blocked;
}

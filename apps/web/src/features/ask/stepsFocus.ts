// The working message goes in the same render that adds the answer or the stopped steps in its
// place, so focus on one of its buttons is handed to their toggle instead of falling to the page.
let pending: string | null = null;

export function handStepsFocus(runId: string): void {
  pending = runId;
  // Only a toggle that comes in the same render takes it, never one that shows much later.
  setTimeout(() => {
    if (pending === runId) pending = null;
  }, 0);
}

export function takeStepsFocus(runId: string): boolean {
  if (pending !== runId) return false;
  pending = null;
  return true;
}

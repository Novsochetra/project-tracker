export const SIGN_OF_LIFE_MS = 30_000;

export function spanOf(ms: number): string {
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest}s`;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

export interface StillWorkingDeps {
  log: (text: string) => void;
  every?: number | undefined;
}

// claude -p prints nothing until it finishes, so without this the window looks dead for the whole
// run and nobody can tell a long run from a stuck one (PT-155).
export function showStillWorking(
  ticketKey: string,
  { log, every = SIGN_OF_LIFE_MS }: StillWorkingDeps,
): () => void {
  const started = Date.now();
  const timer = setInterval(() => {
    log(`Still working on ${ticketKey}… (${spanOf(Date.now() - started)})`);
  }, every);
  timer.unref();
  return () => clearInterval(timer);
}

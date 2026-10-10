const FIRST_MS = 1_000;
const LONGEST_MS = 15_000;

export const retryDelay = (attempt: number): number =>
  Math.min(FIRST_MS * 2 ** attempt, LONGEST_MS);

export const wait = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });

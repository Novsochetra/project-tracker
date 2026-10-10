import type { Writable } from 'node:stream';

const STOP_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;

// Every handler goes at the first signal, so the next one of any kind quits at once.
export const untilSignal = (): Promise<void> =>
  new Promise((resolve) => {
    const stop = () => {
      for (const signal of STOP_SIGNALS) process.off(signal, stop);
      resolve();
    };
    for (const signal of STOP_SIGNALS) process.on(signal, stop);
  });

// A closed terminal can't show the run's end anyway; the helper must still report it.
export function ignoreClosedTerminal(stream: Writable): void {
  stream.on('error', () => undefined);
}

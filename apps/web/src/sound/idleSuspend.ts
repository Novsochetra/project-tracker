import type { Voice } from './cues';

// A running AudioContext keeps the audio hardware awake and costs a phone battery, so it sleeps a
// second after the last cue ends; the next cue wakes it again (player.ts).
export const IDLE_SECONDS = 1;

export const cueSeconds = (voices: readonly Voice[]): number =>
  Math.max(...voices.map((voice) => voice.start + voice.duration));

export function createIdleSuspend(context: AudioContext): (busySeconds: number) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return (busySeconds) => {
    clearTimeout(timer);
    timer = setTimeout(
      () => {
        if (context.state === 'running') context.suspend().catch(() => undefined);
      },
      (busySeconds + IDLE_SECONDS) * 1000,
    );
  };
}

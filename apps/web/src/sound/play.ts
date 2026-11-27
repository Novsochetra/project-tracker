import type { Status } from '@tracker/shared';
import type { Cue } from './cues';
import { browserAudioContext, createSoundPlayer } from './player';
import { soundsOn } from './soundSetting';

const player = createSoundPlayer({
  createContext: browserAudioContext,
  isEnabled: soundsOn,
  isHidden: () => typeof document !== 'undefined' && document.hidden,
});

// A sheet that a choice closes (Create, a capture sent) goes a moment after the choice sounded, so
// its close would land on top of the choice: one action, one sound.
export const CLOSE_AFTER_CUE_MS = 150;
let lastCueAt = Number.NEGATIVE_INFINITY;

export function playSound(cue: Cue): void {
  const now = performance.now();
  if (cue === 'sheetClose' && now - lastCueAt < CLOSE_AFTER_CUE_MS) return;

  if (player.play(cue)) lastCueAt = now;
}

// Finishing a ticket chimes; any other move clicks.
export function playMoveSound(to: Pick<Status, 'category'>): void {
  playSound(to.category === 'done' ? 'done' : 'tick');
}

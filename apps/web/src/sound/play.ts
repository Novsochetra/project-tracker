import type { Status } from '@tracker/shared';
import type { Cue } from './cues';
import { browserAudioContext, createSoundPlayer } from './player';
import { soundsOn } from './soundSetting';

const player = createSoundPlayer({
  createContext: browserAudioContext,
  isEnabled: soundsOn,
  isHidden: () => typeof document !== 'undefined' && document.hidden,
});

export function playSound(cue: Cue): void {
  player.play(cue);
}

// Finishing a ticket chimes; any other move clicks.
export function playMoveSound(to: Pick<Status, 'category'>): void {
  playSound(to.category === 'done' ? 'done' : 'tick');
}

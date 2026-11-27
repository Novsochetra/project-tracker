import { describe, expect, it, vi } from 'vitest';
import { playMoveSound, playSound } from './play';

const { play } = vi.hoisted(() => ({ play: vi.fn() }));

vi.mock('./player', () => ({
  createSoundPlayer: () => ({ play }),
  browserAudioContext: () => null,
}));

describe('playSound', () => {
  it('hands the cue to the page’s one player', () => {
    playSound('sent');
    expect(play).toHaveBeenLastCalledWith('sent');
  });
});

describe('playMoveSound', () => {
  it('chimes for a Done status and clicks for any other', () => {
    playMoveSound({ category: 'done' });
    expect(play).toHaveBeenLastCalledWith('done');
    playMoveSound({ category: 'in_review' });
    expect(play).toHaveBeenLastCalledWith('tick');
  });
});

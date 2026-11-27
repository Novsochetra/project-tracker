import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLOSE_AFTER_CUE_MS, playMoveSound, playSound } from './play';

const { play } = vi.hoisted(() => ({ play: vi.fn(() => true) }));

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

describe('a sheet closed by a choice', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('plays only the choice: Create sounds "sent", and the sheet going right after stays quiet', () => {
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(10_000);
    playSound('sent');
    play.mockClear();
    now.mockReturnValue(10_025);
    playSound('sheetClose');
    expect(play).not.toHaveBeenCalled();
  });

  it('still sounds when the sheet is closed on its own', () => {
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(20_000);
    playSound('sheetOpen');
    play.mockClear();
    now.mockReturnValue(20_000 + CLOSE_AFTER_CUE_MS + 1);
    playSound('sheetClose');
    expect(play).toHaveBeenCalledWith('sheetClose');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { CUES } from './cues';
import { createSoundPlayer, type SoundPlayerPorts } from './player';
import { fakeAudioContext } from './test/fakeAudio';

function setup(overrides: Partial<SoundPlayerPorts> = {}, state?: AudioContextState) {
  const audio = fakeAudioContext(state);
  const createContext = vi.fn(() => audio.context);
  const player = createSoundPlayer({
    createContext,
    isEnabled: () => true,
    isHidden: () => false,
    ...overrides,
  });

  return { player, createContext, audio };
}

describe('createSoundPlayer', () => {
  it('makes no audio context until the first cue, which follows a tap', () => {
    const { player, createContext } = setup();
    expect(createContext).not.toHaveBeenCalled();
    expect(player.play('tick')).toBe(true);
    player.play('done');
    expect(createContext).toHaveBeenCalledTimes(1);
  });

  it('starts every voice of the cue a hair after now', () => {
    const { player, audio } = setup();
    player.play('done');
    expect(audio.started).toHaveLength(CUES.done.length);
    expect(audio.started.every(({ at }) => at > 2)).toBe(true);
  });

  it('stays quiet while sounds are off, without making a context', () => {
    const { player, createContext } = setup({ isEnabled: () => false });
    expect(player.play('tick')).toBe(false);
    expect(createContext).not.toHaveBeenCalled();
  });

  it('stays quiet while the page is hidden', () => {
    const { player, audio } = setup({ isHidden: () => true });
    expect(player.play('sheetOpen')).toBe(false);
    expect(audio.started).toEqual([]);
  });

  it('wakes a context the browser suspended', () => {
    const { player, audio } = setup({}, 'suspended');
    player.play('tick');
    expect(audio.raw.resume).toHaveBeenCalled();
  });

  it('asks only once on a browser without Web Audio', () => {
    const createContext = vi.fn(() => null);
    const player = createSoundPlayer({
      createContext,
      isEnabled: () => true,
      isHidden: () => false,
    });
    expect(player.play('tick')).toBe(false);
    expect(player.play('tick')).toBe(false);
    expect(createContext).toHaveBeenCalledTimes(1);
  });
});

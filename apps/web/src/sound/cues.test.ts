import { describe, expect, it } from 'vitest';
import { CUES, type Cue } from './cues';

const cues = Object.entries(CUES) as [Cue, (typeof CUES)[Cue]][];
const end = (cue: Cue) => Math.max(...CUES[cue].map((voice) => voice.start + voice.duration));

describe('sound cues', () => {
  it.each(cues)('%s is short, quiet and audible', (_name, voices) => {
    expect(voices.length).toBeGreaterThan(0);
    for (const voice of voices) {
      expect(voice.gain).toBeGreaterThan(0);
      expect(voice.gain).toBeLessThanOrEqual(0.1);
      expect(voice.attack).toBeLessThan(voice.duration);
      expect(voice.frequency.every((hz) => hz >= 20 && hz <= 20_000)).toBe(true);
    }
  });

  it('keeps every click under a tenth of a second, so a quick run of them never blurs', () => {
    expect(end('tick')).toBeLessThan(0.1);
    expect(end('switchOn')).toBeLessThan(0.1);
    expect(end('switchOff')).toBeLessThan(0.1);
  });

  it('ends every cue within half a second', () => {
    for (const [name] of cues) {
      expect(end(name), name).toBeLessThanOrEqual(0.5);
    }
  });

  it('rises for Done', () => {
    const pitches = CUES.done
      .filter((voice) => voice.kind === 'tone')
      .map((voice) => voice.frequency[0]);
    expect(pitches).toEqual([...pitches].sort((low, high) => low - high));
  });
});

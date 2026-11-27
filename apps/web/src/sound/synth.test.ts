import { describe, expect, it } from 'vitest';
import { CUES, type Voice } from './cues';
import { createNoiseBuffer, envelopeSteps, frequencySteps, SILENCE } from './synth';
import { fakeAudioContext } from './test/fakeAudio';

const voice: Voice = {
  kind: 'tone',
  wave: 'sine',
  frequency: [440, 880],
  start: 0,
  duration: 0.2,
  gain: 0.05,
  attack: 0.01,
};

describe('envelopeSteps', () => {
  it('starts silent, rises to the gain over the attack and fades back by the end', () => {
    expect(envelopeSteps(voice, 1)).toEqual([
      { type: 'set', value: SILENCE, time: 1 },
      { type: 'linear', value: 0.05, time: 1.01 },
      { type: 'exponential', value: SILENCE, time: 1.2 },
    ]);
  });
});

describe('frequencySteps', () => {
  it('glides from one pitch to the other', () => {
    expect(frequencySteps(voice, 1)).toEqual([
      { type: 'set', value: 440, time: 1 },
      { type: 'exponential', value: 880, time: 1.2 },
    ]);
  });

  it('holds a steady pitch with a single step', () => {
    expect(frequencySteps({ ...voice, frequency: [600, 600] }, 0)).toEqual([
      { type: 'set', value: 600, time: 0 },
    ]);
  });

  it('works for noise too, where the pitch is the filter', () => {
    expect(frequencySteps(CUES.sheetClose[0]!, 0)).toHaveLength(2);
  });
});

describe('createNoiseBuffer', () => {
  it('fills a second of samples between -1 and 1', () => {
    const { context } = fakeAudioContext();
    const samples = createNoiseBuffer(context).getChannelData(0);
    expect(samples).toHaveLength(100);
    expect([...samples].every((sample) => sample >= -1 && sample <= 1)).toBe(true);
  });
});

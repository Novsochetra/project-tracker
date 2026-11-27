// Every cue is synthesized, so the app ships no audio files. A voice is a tone (an oscillator) or a
// breath of filtered noise; frequency is [from, to] in Hz, times and durations in seconds.
export interface ToneVoice {
  kind: 'tone';
  wave: OscillatorType;
  frequency: readonly [number, number];
  start: number;
  duration: number;
  gain: number;
  attack: number;
}

export interface NoiseVoice {
  kind: 'noise';
  filter: BiquadFilterType;
  frequency: readonly [number, number];
  resonance: number;
  start: number;
  duration: number;
  gain: number;
  attack: number;
}

export type Voice = ToneVoice | NoiseVoice;

interface Timing {
  start?: number;
  duration: number;
  gain: number;
  attack?: number;
}

const tone = (
  wave: OscillatorType,
  frequency: readonly [number, number],
  { start = 0, duration, gain, attack = 0.004 }: Timing,
): ToneVoice => ({ kind: 'tone', wave, frequency, start, duration, gain, attack });

const noise = (
  filter: BiquadFilterType,
  frequency: readonly [number, number],
  { start = 0, duration, gain, attack = 0.01 }: Timing,
): NoiseVoice => ({
  kind: 'noise',
  filter,
  frequency,
  resonance: 1,
  start,
  duration,
  gain,
  attack,
});

// A rising C major triad: finishing a ticket always resolves upward.
const DONE_CHIME = [523.25, 659.25, 783.99];

export const CUES = {
  // One crisp click for every choice: a segment, a row lifted to drag, a swipe that commits.
  tick: [
    tone('triangle', [1500, 1100], { duration: 0.035, gain: 0.07, attack: 0.001 }),
    tone('sine', [600, 600], { duration: 0.04, gain: 0.03 }),
  ],
  switchOn: [
    tone('triangle', [1700, 1300], { duration: 0.035, gain: 0.07, attack: 0.001 }),
    tone('sine', [880, 880], { start: 0.02, duration: 0.06, gain: 0.03 }),
  ],
  switchOff: [
    tone('triangle', [1200, 900], { duration: 0.035, gain: 0.06, attack: 0.001 }),
    tone('sine', [520, 520], { start: 0.02, duration: 0.05, gain: 0.025 }),
  ],
  sheetOpen: [
    noise('lowpass', [400, 2600], { duration: 0.24, gain: 0.04, attack: 0.07 }),
    tone('sine', [440, 660], { duration: 0.18, gain: 0.025, attack: 0.02 }),
  ],
  sheetClose: [noise('lowpass', [2400, 380], { duration: 0.2, gain: 0.035, attack: 0.02 })],
  sent: [
    tone('sine', [660, 990], { duration: 0.12, gain: 0.07 }),
    tone('sine', [1320, 1320], { start: 0.06, duration: 0.18, gain: 0.035 }),
  ],
  done: [
    ...DONE_CHIME.map((pitch, i) =>
      tone('sine', [pitch, pitch], { start: i * 0.06, duration: 0.28 + i * 0.05, gain: 0.06 }),
    ),
    noise('highpass', [5000, 9000], { start: 0.12, duration: 0.3, gain: 0.02, attack: 0.04 }),
  ],
} satisfies Record<string, readonly Voice[]>;

export type Cue = keyof typeof CUES;

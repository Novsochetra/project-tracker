import type { Voice } from './cues';

// Exponential ramps cannot reach zero, so a voice fades to this instead.
export const SILENCE = 0.0001;
const NOISE_SECONDS = 1;
// A source runs on a little past its fade, so the fade's tail is never cut to a click.
const TAIL_SECONDS = 0.05;

export interface RampStep {
  type: 'set' | 'linear' | 'exponential';
  value: number;
  time: number;
}

export interface SoundGraph {
  context: AudioContext;
  destination: AudioNode;
  noiseBuffer: AudioBuffer;
}

export function envelopeSteps(voice: Voice, at: number): RampStep[] {
  return [
    { type: 'set', value: SILENCE, time: at },
    { type: 'linear', value: voice.gain, time: at + voice.attack },
    { type: 'exponential', value: SILENCE, time: at + voice.duration },
  ];
}

export function frequencySteps(voice: Voice, at: number): RampStep[] {
  const [from, to] = voice.frequency;
  const steps: RampStep[] = [{ type: 'set', value: from, time: at }];

  return from === to
    ? steps
    : [...steps, { type: 'exponential', value: to, time: at + voice.duration }];
}

function applySteps(param: AudioParam, steps: RampStep[]): void {
  for (const step of steps) {
    if (step.type === 'set') param.setValueAtTime(step.value, step.time);
    else if (step.type === 'linear') param.linearRampToValueAtTime(step.value, step.time);
    else param.exponentialRampToValueAtTime(step.value, step.time);
  }
}

export function createNoiseBuffer(context: BaseAudioContext, seconds = NOISE_SECONDS): AudioBuffer {
  const length = Math.round(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    samples[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

function createSource(graph: SoundGraph, voice: Voice) {
  const { context } = graph;
  if (voice.kind === 'tone') {
    const oscillator = context.createOscillator();
    oscillator.type = voice.wave;

    return { source: oscillator, output: oscillator, pitch: oscillator.frequency };
  }

  const source = context.createBufferSource();
  source.buffer = graph.noiseBuffer;
  const filter = context.createBiquadFilter();
  filter.type = voice.filter;
  filter.Q.value = voice.resonance;
  source.connect(filter);

  return { source, output: filter, pitch: filter.frequency };
}

export function scheduleVoice(graph: SoundGraph, voice: Voice, startTime: number): void {
  const at = startTime + voice.start;
  const parts = createSource(graph, voice);
  const amp = graph.context.createGain();
  applySteps(parts.pitch, frequencySteps(voice, at));
  applySteps(amp.gain, envelopeSteps(voice, at));
  parts.output.connect(amp);
  amp.connect(graph.destination);
  parts.source.start(at);
  parts.source.stop(at + voice.duration + TAIL_SECONDS);
}

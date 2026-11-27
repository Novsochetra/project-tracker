import { vi } from 'vitest';

// Just enough of Web Audio to see what a cue schedules: jsdom has none.
function fakeParam() {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

function fakeNode(extra: object = {}) {
  return { connect: vi.fn(), ...extra };
}

export function fakeAudioContext(state: AudioContextState = 'running') {
  const started: { kind: string; at: number }[] = [];
  const source = (kind: string) =>
    fakeNode({
      type: '',
      buffer: null,
      frequency: fakeParam(),
      start: vi.fn((at: number) => started.push({ kind, at })),
      stop: vi.fn(),
    });

  const context = {
    state,
    currentTime: 2,
    sampleRate: 100,
    destination: fakeNode(),
    resume: vi.fn().mockResolvedValue(undefined),
    createGain: vi.fn(() => fakeNode({ gain: fakeParam() })),
    createDynamicsCompressor: vi.fn(() => fakeNode()),
    createOscillator: vi.fn(() => source('tone')),
    createBufferSource: vi.fn(() => source('noise')),
    createBiquadFilter: vi.fn(() => fakeNode({ type: '', Q: fakeParam(), frequency: fakeParam() })),
    createBuffer: vi.fn((_channels: number, length: number) => {
      const samples = new Float32Array(length);

      return { getChannelData: () => samples };
    }),
  };

  return { context: context as unknown as AudioContext, raw: context, started };
}

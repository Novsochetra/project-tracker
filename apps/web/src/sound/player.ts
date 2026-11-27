import { CUES, type Cue } from './cues';
import { createNoiseBuffer, scheduleVoice, type SoundGraph } from './synth';

export const MASTER_VOLUME = 0.7;
// Scheduling a hair ahead keeps the first voice of a cue from being clipped by the audio thread.
const LOOKAHEAD = 0.01;

export interface SoundPlayerPorts {
  createContext: () => AudioContext | null;
  isEnabled: () => boolean;
  isHidden: () => boolean;
}

export interface SoundPlayer {
  play: (cue: Cue) => boolean;
}

function buildGraph(context: AudioContext): SoundGraph {
  const master = context.createGain();
  master.gain.value = MASTER_VOLUME;
  // A gentle limiter, so cues fired close together never clip.
  const limiter = context.createDynamicsCompressor();
  master.connect(limiter);
  limiter.connect(context.destination);

  return { context, destination: master, noiseBuffer: createNoiseBuffer(context) };
}

function wake(context: AudioContext): void {
  if (context.state === 'suspended') {
    context.resume().catch(() => undefined);
  }
}

// Browsers only let audio start after a tap, click or key press, so the context is made on the
// first cue, which always follows one.
export function createSoundPlayer({
  createContext,
  isEnabled,
  isHidden,
}: SoundPlayerPorts): SoundPlayer {
  let graph: SoundGraph | null = null;
  let unavailable = false;

  function ensureGraph(): SoundGraph | null {
    if (!graph && !unavailable) {
      const context = createContext();
      graph = context ? buildGraph(context) : null;
      unavailable = graph === null;
    }

    if (graph) wake(graph.context);

    return graph;
  }

  function play(cue: Cue): boolean {
    if (!isEnabled() || isHidden()) return false;

    const ready = ensureGraph();
    if (!ready) return false;

    const startTime = ready.context.currentTime + LOOKAHEAD;
    for (const voice of CUES[cue]) {
      scheduleVoice(ready, voice, startTime);
    }

    return true;
  }

  return { play };
}

export function browserAudioContext(): AudioContext | null {
  const scope = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const AudioContextClass = scope.AudioContext ?? scope.webkitAudioContext;
  if (!AudioContextClass) return null;

  try {
    return new AudioContextClass({ latencyHint: 'interactive' });
  } catch {
    return null;
  }
}

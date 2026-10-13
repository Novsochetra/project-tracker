import { describe, expect, it } from 'vitest';
import { RUN_PROMPT_MAX } from '../src/domain/run';
import {
  chainRound,
  chainStopReason,
  nextChainStep,
  type ChainFacts,
} from '../src/logic/reviewChain';

const facts = (changes: Partial<ChainFacts> = {}): ChainFacts => ({
  run: { role: 'work', round: 1 },
  category: 'in_review',
  personMoved: false,
  helperOnline: true,
  promptLength: 1_000,
  ...changes,
});

describe('nextChainStep', () => {
  it('sends work that reached review to a reviewer in the same round', () => {
    expect(nextChainStep(facts())).toEqual({ kind: 'queue', role: 'review', round: 1 });
  });

  it('sends work back to a worker when the review asks for changes, as the next round', () => {
    const step = nextChainStep(facts({ run: { role: 'review', round: 1 }, category: 'todo' }));
    expect(step).toEqual({ kind: 'queue', role: 'work', round: 2 });
  });

  it('reviews the second round of work too', () => {
    const step = nextChainStep(facts({ run: { role: 'work', round: 2 } }));
    expect(step).toEqual({ kind: 'queue', role: 'review', round: 2 });
  });

  it('stops after two rounds of work when the second review asks for changes again', () => {
    const step = nextChainStep(facts({ run: { role: 'review', round: 2 }, category: 'todo' }));
    expect(step).toEqual({ kind: 'stop', reason: 'rounds' });
  });

  it('gives a review a person started two rounds of work', () => {
    const step = nextChainStep(facts({ run: { role: 'review', round: 0 }, category: 'todo' }));
    expect(step).toEqual({ kind: 'queue', role: 'work', round: 1 });
  });

  it('stops when a person moved the ticket during the run, wherever it is now', () => {
    for (const category of ['in_review', 'todo', 'in_progress', 'done'] as const) {
      expect(nextChainStep(facts({ category, personMoved: true }))).toEqual({
        kind: 'stop',
        reason: 'moved',
      });
    }
  });

  it('stops when the helper is offline, since the next run would wait for nobody', () => {
    expect(nextChainStep(facts({ helperOnline: false }))).toEqual({
      kind: 'stop',
      reason: 'offline',
    });
  });

  it('stops when the next prompt is longer than Run would send, rather than queue it', () => {
    expect(nextChainStep(facts({ promptLength: RUN_PROMPT_MAX }))).toEqual({
      kind: 'queue',
      role: 'review',
      round: 1,
    });
    expect(nextChainStep(facts({ promptLength: RUN_PROMPT_MAX + 1 }))).toEqual({
      kind: 'stop',
      reason: 'too_long',
    });
  });

  it('ends quietly where the chain has nothing more to do', () => {
    const ends: Partial<ChainFacts>[] = [
      { run: { role: 'review', round: 1 }, category: 'reviewed' },
      { run: { role: 'work', round: 1 }, category: 'in_progress' },
      { run: { role: 'review', round: 1 }, category: 'in_review' },
      { run: { role: 'work', round: 1 }, category: 'todo', helperOnline: false },
    ];
    for (const end of ends) expect(nextChainStep(facts(end))).toEqual({ kind: 'none' });
  });
});

describe('chainRound', () => {
  it("counts a person's work run as the first round and their review as none yet", () => {
    expect(chainRound('work', null)).toBe(1);
    expect(chainRound('review', null)).toBe(0);
    expect(chainRound('work', 2)).toBe(2);
  });
});

describe('chainStopReason', () => {
  it('says why the automatic review stopped, naming the helper when it is the reason', () => {
    expect(chainStopReason('rounds', 'Mac')).toBe(
      'The review still asks for changes after 2 rounds.',
    );
    expect(chainStopReason('moved', 'Mac')).toBe('You moved the ticket.');
    expect(chainStopReason('offline', 'Mac')).toBe("Mac can't take the next run.");
    expect(chainStopReason('too_long', 'Mac')).toBe('The next prompt is too long to run.');
    expect(chainStopReason('paused', 'Mac')).toBe('');
    expect(chainStopReason('constructor', 'Mac')).toBe('');
  });
});

import { describe, expect, it } from 'vitest';
import { chainRound, nextChainStep, type ChainFacts } from '../src/logic/reviewChain';

const facts = (changes: Partial<ChainFacts> = {}): ChainFacts => ({
  run: { role: 'work', round: 1 },
  category: 'in_review',
  personMoved: false,
  helperOnline: true,
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

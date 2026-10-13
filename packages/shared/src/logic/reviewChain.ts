import { AUTO_REVIEW_ROUNDS, type ChainStop } from '../domain/autoReview';
import type { RunRole } from '../domain/run';
import type { StatusCategory } from '../domain/status';

export interface EndedChainRun {
  role: RunRole;
  // How many work runs the chain has had, this one included; a person's review starts at 0.
  round: number;
}

export interface ChainFacts {
  run: EndedChainRun;
  category: StatusCategory;
  personMoved: boolean;
  helperOnline: boolean;
}

export type ChainStep =
  | { kind: 'none' }
  | { kind: 'stop'; reason: ChainStop }
  | { kind: 'queue'; role: RunRole; round: number };

const NONE: ChainStep = { kind: 'none' };

function nextRun({ role, round }: EndedChainRun, category: StatusCategory): ChainStep {
  if (role === 'work' && category === 'in_review') return { kind: 'queue', role: 'review', round };
  if (role === 'review' && category === 'todo') {
    return { kind: 'queue', role: 'work', round: round + 1 };
  }
  return NONE;
}

// A person who moved the ticket took it over, so nothing more starts, wherever it is now.
export function nextChainStep({ run, category, personMoved, helperOnline }: ChainFacts): ChainStep {
  if (personMoved) return { kind: 'stop', reason: 'moved' };
  const next = nextRun(run, category);
  if (next.kind !== 'queue') return next;
  if (next.round > AUTO_REVIEW_ROUNDS) return { kind: 'stop', reason: 'rounds' };
  if (!helperOnline) return { kind: 'stop', reason: 'offline' };
  return next;
}

// Runs a person started have no round: their work is the first, their review comes before any.
export const chainRound = (role: RunRole, round: number | null): number =>
  round ?? (role === 'work' ? 1 : 0);

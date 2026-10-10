import type { RunStep } from '../../domain/runStep';

type Shown = Pick<RunStep, 'kind' | 'subAgent' | 'label'>;

const CUT = /…$/;

// An answered run's last words are the answer, shown right under its folded steps, so the open
// list leaves them out rather than repeat them, and its count with them; words that differ from
// the answer stay.
export function isAnswerStep(step: Shown, answer: string): boolean {
  if (step.kind !== 'text' || step.subAgent) return false;
  const words = step.label.replace(CUT, '').trim();
  return words !== '' && answer.trim().startsWith(words);
}

export function withoutAnswer<T extends Shown>(steps: readonly T[], answer: string): T[] {
  const last = steps.at(-1);
  return last && isAnswerStep(last, answer) ? steps.slice(0, -1) : [...steps];
}

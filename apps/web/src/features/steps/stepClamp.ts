import type { StepVariant } from './stepVariant';
import type { StepRow } from './stepRows';

// Lines a text step shows, or null for all. While Claude works only its newest words show whole:
// a long text step that stayed whole dropped the working message by hundreds of pixels at once
// when it left the newest few. A folded answer's words are quiet rows, since the answer is below.
export function textLines(
  variant: StepVariant,
  row: Pick<StepRow, 'kind'>,
  newest: boolean,
): number | null {
  if (row.kind !== 'text') return null;
  if (variant === 'history') return 2;
  return variant === 'live' && !newest ? 3 : null;
}

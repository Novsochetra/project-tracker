import type { StepRow } from './stepRows';
import type { StepVariant } from './stepVariant';

export const LIVE_TEXT_LINES = 3;

export interface CutInput {
  newest: boolean;
  // The person opened every earlier step, so they are reading, not watching.
  whole: boolean;
}

// While Claude works only its newest words show whole and earlier ones are cut, since a long text
// step that stayed whole dropped the working message by hundreds of pixels when it left the newest
// few. A cut one opens with a tap, and a folded answer's list and a sheet cut nothing.
export const isCut = (
  variant: StepVariant,
  row: Pick<StepRow, 'kind'>,
  { newest, whole }: CutInput,
): boolean => variant === 'live' && row.kind === 'text' && !newest && !whole;

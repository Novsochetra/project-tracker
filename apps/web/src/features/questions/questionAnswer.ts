import type { AnswerQuestionInput } from '@tracker/shared';

export interface QuestionPick {
  chosen: string | null;
  other: string;
}

export const NO_PICK: QuestionPick = { chosen: null, other: '' };

export const SKIP: AnswerQuestionInput = { skip: true };

// One choice, or one's own words: picking either drops the other.
export const pickChoice = (label: string): QuestionPick => ({ chosen: label, other: '' });

export const typeOther = (pick: QuestionPick, other: string): QuestionPick =>
  other.trim() ? { chosen: null, other } : { ...pick, other };

export function answerOf({ chosen, other }: QuestionPick): AnswerQuestionInput | null {
  const answer = chosen ?? other.trim();

  return answer ? { answer } : null;
}

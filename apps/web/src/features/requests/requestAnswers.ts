import {
  RUN_REQUEST_ANSWER_MAX,
  type AnswerRunRequestInput,
  type RunQuestion,
} from '@tracker/shared';

export const ALLOW: AnswerRunRequestInput = { decision: 'allow' };
export const DENY: AnswerRunRequestInput = { decision: 'deny' };
// Declining a question tells Claude the person chose not to answer, and it goes on.
export const SKIP: AnswerRunRequestInput = { decision: 'deny' };

export interface QuestionPick {
  chosen: string[];
  other: string;
}

export const NO_PICK: QuestionPick = { chosen: [], other: '' };

export const noPicks = (questions: readonly RunQuestion[]): QuestionPick[] =>
  questions.map(() => NO_PICK);

// One question with one choice is answered by the tap on a choice, as in the desktop app.
export const answersAtOnce = (questions: readonly RunQuestion[]): boolean =>
  questions.length === 1 && questions[0]?.multiSelect === false;

const inOptionOrder = (question: RunQuestion, labels: ReadonlySet<string>): string[] =>
  question.options.map(({ label }) => label).filter((label) => labels.has(label));

const SEPARATOR = ', ';

// What the own words may take beside the picked choices, so the answer fits the tracker's limit
// as typed and nothing is cut unseen.
export const otherRoom = (chosen: readonly string[]): number =>
  Math.max(
    0,
    RUN_REQUEST_ANSWER_MAX -
      chosen.reduce((sum, label) => sum + label.length + SEPARATOR.length, 0),
  );

// One choice, or one's own words: picking either drops the other.
export function togglePick(question: RunQuestion, pick: QuestionPick, label: string): QuestionPick {
  if (!question.multiSelect) {
    return { chosen: pick.chosen[0] === label ? [] : [label], other: '' };
  }
  const labels = new Set(pick.chosen);
  if (labels.has(label)) labels.delete(label);
  else labels.add(label);
  const chosen = inOptionOrder(question, labels);
  // A choice added after long own words shortens them in the box, where the person sees it.
  return { chosen, other: pick.other.slice(0, otherRoom(chosen)) };
}

export const typeOther = (
  question: RunQuestion,
  pick: QuestionPick,
  other: string,
): QuestionPick =>
  question.multiSelect || !other.trim() ? { ...pick, other } : { chosen: [], other };

// Several choices go back as one answer, as Claude Code joins them.
export const answerOf = ({ chosen, other }: QuestionPick): string =>
  [...chosen, other.trim()].filter(Boolean).join(SEPARATOR);

export function questionAnswers(picks: readonly QuestionPick[]): AnswerRunRequestInput | null {
  const answers = picks.map(answerOf);
  if (answers.length === 0 || answers.some((answer) => !answer)) return null;
  return { decision: 'allow', answers };
}

export const choiceAnswer = (label: string): AnswerRunRequestInput => ({
  decision: 'allow',
  answers: [label],
});

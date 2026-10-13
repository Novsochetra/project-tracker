import { z } from 'zod';
import {
  QUESTION_ANSWER_MAX,
  QUESTION_CHOICE_MAX,
  QUESTION_CHOICES_MAX,
  QUESTION_TEXT_MAX,
} from '../domain/ticketQuestion';

const text = (max: number, empty: string) =>
  z.string().trim().min(1, empty).max(max, `Use at most ${max} characters.`);

// The phone shows each choice as a button named by its text, so two alike would be one answer.
const distinct = (choices: readonly string[]) =>
  new Set(choices.map((choice) => choice.toLowerCase())).size === choices.length;

export const askQuestionInput = z.object({
  question: text(QUESTION_TEXT_MAX, 'Write the question.'),
  choices: z
    .array(text(QUESTION_CHOICE_MAX, 'A choice cannot be empty.'))
    .max(QUESTION_CHOICES_MAX, `Give at most ${QUESTION_CHOICES_MAX} choices.`)
    .refine(distinct, 'Give each choice once.')
    .default([]),
});
export type AskQuestionInput = z.input<typeof askQuestionInput>;

export const answerQuestionInput = z.union([
  z.strictObject({ answer: text(QUESTION_ANSWER_MAX, 'Write an answer.') }),
  z.strictObject({ skip: z.literal(true) }),
]);
export type AnswerQuestionInput = z.input<typeof answerQuestionInput>;

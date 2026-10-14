import { z } from 'zod';
import {
  RUN_QUESTION_HEADER_MAX,
  RUN_QUESTION_MAX,
  RUN_QUESTION_OPTION_DESCRIPTION_MAX,
  RUN_QUESTION_OPTION_MAX,
  RUN_QUESTION_OPTIONS_MAX,
  RUN_QUESTIONS_MAX,
  RUN_REQUEST_ANSWER_MAX,
  RUN_REQUEST_DECISIONS,
  RUN_PERMISSION_LABEL_MAX,
  RUN_PLAN_MAX,
  RUN_REQUEST_LABEL_MAX,
} from '../domain/runRequest';
import { runnerId } from './runs';

const text = (max: number, min = 0) => z.string().trim().min(min).max(max);

const runQuestion = z.object({
  question: text(RUN_QUESTION_MAX, 1),
  header: text(RUN_QUESTION_HEADER_MAX),
  options: z
    .array(
      z.object({
        label: text(RUN_QUESTION_OPTION_MAX, 1),
        description: text(RUN_QUESTION_OPTION_DESCRIPTION_MAX),
      }),
    )
    .max(RUN_QUESTION_OPTIONS_MAX),
  multiSelect: z.boolean(),
});

const questionLabel = text(RUN_REQUEST_LABEL_MAX, 1);
const permissionLabel = text(RUN_PERMISSION_LABEL_MAX, 1);

// The helper names itself, so only the helper that took the run asks in it.
export const addRunRequestInput = z.discriminatedUnion('kind', [
  z.object({
    runnerId,
    kind: z.literal('permission'),
    label: permissionLabel,
    labelCut: z.boolean(),
    questions: z.null(),
  }),
  z.object({
    runnerId,
    kind: z.literal('question'),
    label: questionLabel,
    labelCut: z.boolean(),
    questions: z.array(runQuestion).min(1).max(RUN_QUESTIONS_MAX),
  }),
  z.object({
    runnerId,
    kind: z.literal('plan'),
    label: text(RUN_PLAN_MAX, 1),
    labelCut: z.boolean(),
    questions: z.null(),
  }),
]);
export type AddRunRequestInput = z.input<typeof addRunRequestInput>;

// A question is answered with one answer per question, or declined with deny; a permission
// takes a decision alone; a plan is approved with its mode, or kept with an optional note. answerProblem in logic checks the answer fits its request.
export const answerRunRequestInput = z.object({
  decision: z.enum(RUN_REQUEST_DECISIONS),
  answers: z.array(text(RUN_REQUEST_ANSWER_MAX, 1)).min(1).max(RUN_QUESTIONS_MAX).optional(),
});
export type AnswerRunRequestInput = z.input<typeof answerRunRequestInput>;

// The helper ends a request Claude no longer waits for, so the phone never shows a dead card.
export const cancelRunRequestInput = z.object({ runnerId });
export type CancelRunRequestInput = z.input<typeof cancelRunRequestInput>;

// Only the helper that took the run waits for its answers, as only it asks and sends steps.
export const waitRunRequestQuery = z.object({ runnerId });
export type WaitRunRequestQuery = z.input<typeof waitRunRequestQuery>;

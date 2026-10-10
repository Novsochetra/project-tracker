import { RUN_REQUEST_DEADLINE_MS, type RunRequest } from '@tracker/shared';
import { deny, type PromptCall, type PromptDecision } from './promptCall';

const MINUTES = RUN_REQUEST_DEADLINE_MS / 60_000;

export const DENIED = 'The person said no to this from their phone. Go on without it.';
export const DECLINED = 'The person chose not to answer from their phone. Go on without an answer.';
export const NO_ANSWER = `Nobody answered on the phone within ${MINUTES} minutes, so this was not allowed. Go on without it.`;
export const RUN_ENDED = 'The run was stopped, so nobody will answer.';
export const UNREACHABLE =
  "The tracker couldn't be reached to ask the person, so this was not allowed.";
export const UNSHOWN = "This question couldn't be shown on the phone. Go on without an answer.";

const questionTexts = (input: PromptCall['input']): unknown[] =>
  Array.isArray(input.questions)
    ? input.questions.map((question: unknown) => (question as { question?: unknown }).question)
    : [];

// Keyed by Claude's own question text, not the tracker's cut copy: Claude matches answers to its
// questions by their text.
function answersFor(call: PromptCall, request: RunRequest): Record<string, string> {
  const texts = questionTexts(call.input);
  const answers: Record<string, string> = {};
  (request.answers ?? []).forEach((answer, index) => {
    const text = texts[index];
    answers[typeof text === 'string' ? text : (request.questions?.[index]?.question ?? '')] =
      answer;
  });
  return answers;
}

function answered(call: PromptCall, request: RunRequest): PromptDecision {
  const asked = request.kind === 'question';
  if (request.decision !== 'allow') return deny(asked ? DECLINED : DENIED);
  if (!asked) return { behavior: 'allow', updatedInput: call.input };
  return { behavior: 'allow', updatedInput: { ...call.input, answers: answersFor(call, request) } };
}

export function decisionOf(call: PromptCall, request: RunRequest): PromptDecision {
  if (request.status === 'answered') return answered(call, request);
  return deny(request.status === 'expired' ? NO_ANSWER : RUN_ENDED);
}

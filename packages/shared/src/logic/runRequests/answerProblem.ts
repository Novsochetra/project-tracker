import type { AnswerRunRequestInput } from '../../api/runRequests';
import type { RunRequestInput } from '../../domain/runRequest';
import { planModeOf } from './planRequest';

function planProblem({ decision, answers }: AnswerRunRequestInput): string | undefined {
  if (decision === 'deny') {
    return (answers?.length ?? 0) <= 1 ? undefined : 'Keep planning with one note at most.';
  }
  return planModeOf(answers)
    ? undefined
    : 'Approve a plan with the mode to carry it out in: edit or auto.';
}

export function answerProblem(
  request: Pick<RunRequestInput, 'kind' | 'questions'>,
  input: AnswerRunRequestInput,
): string | undefined {
  const { decision, answers } = input;
  if (request.kind === 'plan') return planProblem(input);
  if (request.kind === 'permission') {
    return answers === undefined ? undefined : 'Answer a permission with allow or deny alone.';
  }
  if (decision === 'deny') {
    return answers === undefined ? undefined : 'Send no answers when you decline a question.';
  }
  const count = request.questions?.length ?? 0;
  return answers?.length === count
    ? undefined
    : `Send one answer for each of the ${count} questions.`;
}

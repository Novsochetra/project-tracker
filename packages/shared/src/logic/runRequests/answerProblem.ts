import type { AnswerRunRequestInput } from '../../api/runRequests';
import type { RunRequestInput } from '../../domain/runRequest';
import { planModeOf } from './planRequest';

type Asked = Pick<RunRequestInput, 'kind' | 'questions' | 'labelCut'>;

// Auto asks nothing on the way, so a plan the person could not read whole is approved in Edit.
function planProblem(cut: boolean, { decision, answers }: AnswerRunRequestInput) {
  if (decision === 'deny') {
    return (answers?.length ?? 0) <= 1 ? undefined : 'Keep planning with one note at most.';
  }
  const mode = planModeOf(answers);
  if (!mode) return 'Approve a plan with the mode to carry it out in: edit or auto.';
  return cut && mode === 'auto'
    ? 'A plan cut at its limit can be approved in Edit only.'
    : undefined;
}

export function answerProblem(request: Asked, input: AnswerRunRequestInput): string | undefined {
  const { decision, answers } = input;
  if (request.kind === 'plan') return planProblem(request.labelCut, input);
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

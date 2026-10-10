import type { AnswerRunRequestInput } from '../../api/runRequests';
import type { RunRequestInput } from '../../domain/runRequest';

export function answerProblem(
  request: Pick<RunRequestInput, 'kind' | 'questions'>,
  { decision, answers }: AnswerRunRequestInput,
): string | undefined {
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

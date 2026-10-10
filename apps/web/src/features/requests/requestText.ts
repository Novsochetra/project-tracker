import { labelHead, type RunQuestion, type RunRequest } from '@tracker/shared';
import { OUTCOME_TEXT, PERMISSION_HEAD, QUESTION_HEAD } from './copy';
import { showHidden } from './hiddenChars';
import { requestState } from './requestState';

export type Outcome = keyof typeof OUTCOME_TEXT | 'answered';

export interface LabelParts {
  verb: string;
  detail: string;
}

// The helper's labels start with what Claude asks to do (shared logic/runSteps/toolLabel.ts); a
// command, a path or an address follows, and shows as code so the person reads it exactly.
const CODE_VERBS = ['Run', 'Read', 'Edit', 'Write', 'Fetch'];

export function labelParts(label: string): LabelParts {
  const verb = CODE_VERBS.find((known) => label.startsWith(`${known} `));
  return verb ? { verb, detail: label.slice(verb.length + 1) } : { verb: label, detail: '' };
}

// One line: a permission's command may run over many.
export const subjectOf = (request: RunRequest): string =>
  showHidden(
    request.kind === 'question'
      ? (request.questions[0]?.question ?? request.label)
      : labelHead(request.label),
  );

export function requestOutcome(request: RunRequest, now: number): Outcome {
  const state = requestState(request, now);
  if (state === 'ended') return 'none';
  if (request.decision === 'deny') return request.kind === 'question' ? 'skipped' : 'denied';
  return request.kind === 'question' ? 'answered' : 'allowed';
}

const nameOf = (question: RunQuestion): string => question.header || question.question;

export function answerLines(request: RunRequest): string[] {
  if (request.kind !== 'question' || !request.answers) return [];
  const { questions, answers } = request;
  if (questions.length === 1) return answers.slice(0, 1);
  return answers.map((answer, index) => {
    const question = questions[index];
    return question ? `${nameOf(question)}: ${answer}` : answer;
  });
}

export const outcomeLines = (request: RunRequest, now: number): string[] => {
  const outcome = requestOutcome(request, now);
  return outcome === 'answered' ? answerLines(request) : [OUTCOME_TEXT[outcome]];
};

export function announcementOf(request: RunRequest): string {
  const head = request.kind === 'question' ? QUESTION_HEAD : PERMISSION_HEAD;
  return `${head}: ${subjectOf(request)}`;
}

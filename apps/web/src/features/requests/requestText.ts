import {
  labelHead,
  planModeOf,
  type RunQuestion,
  type RunRequest,
  type RunRequestKind,
} from '@tracker/shared';
import { approvedText, OUTCOME_TEXT, PERMISSION_HEAD, PLAN_HEAD, QUESTION_HEAD } from './copy';
import { showHidden } from './hiddenChars';
import { requestState } from './requestState';

export type Outcome = keyof typeof OUTCOME_TEXT | 'answered';

export interface LabelParts {
  verb: string;
  detail: string;
}

// The helper's labels start with what Claude asks to do (shared logic/runSteps/toolLabel.ts); a
// command, a path or an address follows, and shows as code so the person reads it exactly. An MCP
// call's name is one line, and its arguments follow one a line (shared runRequests/toolArguments.ts).
const CODE_VERBS = ['Run', 'Read', 'Edit', 'Write', 'Fetch'];

export function labelParts(label: string): LabelParts {
  const verb = CODE_VERBS.find((known) => label.startsWith(`${known} `));
  if (verb) return { verb, detail: label.slice(verb.length + 1) };
  const [head = '', ...rest] = label.split('\n');
  return { verb: head, detail: rest.join('\n') };
}

// A plan's first line names it, most often as a Markdown heading.
const planTitle = (label: string): string =>
  labelHead((label.split('\n')[0] ?? '').replace(/^#{1,6}\s+/, ''));

function subjectText(request: RunRequest): string {
  if (request.kind === 'question') return request.questions[0]?.question ?? request.label;
  return request.kind === 'plan' ? planTitle(request.label) : labelHead(request.label);
}

// One line: a permission's command may run over many.
export const subjectOf = (request: RunRequest): string => showHidden(subjectText(request));

const ANSWERED: Readonly<Record<RunRequestKind, { allow: Outcome; deny: Outcome }>> = {
  permission: { allow: 'allowed', deny: 'denied' },
  question: { allow: 'answered', deny: 'skipped' },
  plan: { allow: 'approved', deny: 'planning' },
};

export function requestOutcome(request: RunRequest, now: number): Outcome {
  if (requestState(request, now) === 'ended') return 'none';
  return ANSWERED[request.kind][request.decision === 'deny' ? 'deny' : 'allow'];
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

function approvedLines(request: RunRequest): string[] {
  const mode = planModeOf(request.answers);
  return [mode ? approvedText(mode) : OUTCOME_TEXT.approved];
}

export const outcomeLines = (request: RunRequest, now: number): string[] => {
  const outcome = requestOutcome(request, now);
  if (outcome === 'answered') return answerLines(request);
  if (outcome === 'approved') return approvedLines(request);
  if (outcome === 'planning')
    return [OUTCOME_TEXT.planning, ...(request.answers ?? []).slice(0, 1)];
  return [OUTCOME_TEXT[outcome]];
};

const HEADS: Readonly<Record<RunRequestKind, string>> = {
  permission: PERMISSION_HEAD,
  question: QUESTION_HEAD,
  plan: PLAN_HEAD,
};

export const announcementOf = (request: RunRequest): string =>
  `${HEADS[request.kind]}: ${subjectOf(request)}`;

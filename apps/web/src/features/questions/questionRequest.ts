import type {
  AnswerQuestionInput,
  AnswerRunRequestInput,
  RunRequest,
  RunRequestStatus,
  TicketQuestion,
} from '@tracker/shared';

// A question shows in the run requests' card (features/requests), so it reads and answers alike.
const STATUS: Readonly<Record<TicketQuestion['status'], RunRequestStatus>> = {
  open: 'open',
  answered: 'answered',
  skipped: 'answered',
  expired: 'expired',
  cancelled: 'cancelled',
};

const DECISION = { answered: 'allow', skipped: 'deny' } as const;

export function asRunRequest(question: TicketQuestion): RunRequest {
  const { status } = question;
  return {
    kind: 'question',
    label: question.text,
    labelCut: false,
    questions: [
      {
        question: question.text,
        header: '',
        options: question.choices.map((label) => ({ label, description: '' })),
        multiSelect: false,
      },
    ],
    id: question.id,
    runId: question.runId ?? '',
    status: STATUS[status],
    decision: status === 'answered' || status === 'skipped' ? DECISION[status] : null,
    answers: question.answer === null ? null : [question.answer],
    createdAt: question.createdAt,
    expiresAt: question.expiresAt,
    endedAt: question.endedAt,
  };
}

// The card's Skip is a deny; its answer is the one question's.
export const questionAnswer = (input: AnswerRunRequestInput): AnswerQuestionInput => {
  const answer = input.answers?.[0];
  return input.decision === 'allow' && answer ? { answer } : { skip: true };
};

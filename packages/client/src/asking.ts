import type { AnswerQuestionInput, AskQuestionInput, TicketQuestion } from '@tracker/shared';
import { Http, type HttpOptions } from './http';

export const segment = (value: string): string => encodeURIComponent(value);

interface Signal {
  signal?: AbortSignal;
}

export class AskingClient {
  protected readonly http: Http;

  constructor(options: HttpOptions) {
    this.http = new Http(options);
  }

  askQuestion = (ticketKey: string, input: AskQuestionInput) =>
    this.http.request<TicketQuestion>('POST', `/api/tickets/${segment(ticketKey)}/questions`, {
      body: input,
    });

  listQuestions = (ticketKey: string) =>
    this.http.request<TicketQuestion[]>('GET', `/api/tickets/${segment(ticketKey)}/questions`);

  answerQuestion = (questionId: string, input: AnswerQuestionInput) =>
    this.http.request<TicketQuestion>('POST', `/api/questions/${segment(questionId)}/answer`, {
      body: input,
    });

  // A long poll: it may answer with the question still open, and is called again then.
  waitForQuestion = (questionId: string, { signal }: Signal = {}) =>
    this.http.request<TicketQuestion>('GET', `/api/questions/${segment(questionId)}/wait`, {
      signal,
    });

  cancelQuestion = (questionId: string, { signal }: Signal = {}) =>
    this.http.request<TicketQuestion>('POST', `/api/questions/${segment(questionId)}/cancel`, {
      signal,
    });
}

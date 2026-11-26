import type {
  MarkSentInput,
  PromptResult,
  ReportInput,
  ReportPreview,
  ReportResult,
  Ticket,
} from '@tracker/shared';
import { segment } from './asking';
import { SearchClient } from './searchClient';

// Copy prompt and Paste report, apart from the rest so no file grows past its limit.
export class PromptsClient extends SearchClient {
  getProjectPrompt = (key: string) =>
    this.http.request<PromptResult>('GET', `/api/projects/${segment(key)}/prompt`);

  getTicketPrompt = (ticketKey: string) =>
    this.http.request<PromptResult>('GET', `/api/tickets/${segment(ticketKey)}/prompt`);

  markSent = (ticketKey: string, input: MarkSentInput) =>
    this.http.request<Ticket>('POST', `/api/tickets/${segment(ticketKey)}/sent`, { body: input });

  previewReport = (input: ReportInput) =>
    this.http.request<ReportPreview>('POST', '/api/reports/preview', { body: input });

  applyReport = (input: ReportInput) =>
    this.http.request<ReportResult>('POST', '/api/reports/apply', { body: input });
}

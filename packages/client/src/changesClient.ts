import type {
  AddRunChangesInput,
  ChangesVerdictInput,
  TicketChangesAnswer,
  TicketDetail,
  ViewedFileInput,
} from '@tracker/shared';
import { segment } from './asking';
import { RunsClient } from './runsClient';

// A ticket run's code changes (the Changes tab), apart so neither file grows past its limit.
export class ChangesClient extends RunsClient {
  addRunChanges = (
    runId: string,
    input: AddRunChangesInput,
    { signal }: { signal?: AbortSignal } = {},
  ) =>
    this.http.request<void>('POST', `/api/runs/${segment(runId)}/changes`, { body: input, signal });

  getTicketChanges = (ticketKey: string) =>
    this.http.request<TicketChangesAnswer>('GET', `/api/tickets/${segment(ticketKey)}/changes`);

  setFileViewed = (ticketKey: string, input: ViewedFileInput) =>
    this.http.request<void>('PUT', `/api/tickets/${segment(ticketKey)}/changes/viewed`, {
      body: input,
    });

  sendChangesVerdict = (ticketKey: string, input: ChangesVerdictInput) =>
    this.http.request<TicketDetail>('POST', `/api/tickets/${segment(ticketKey)}/changes/verdict`, {
      body: input,
    });
}

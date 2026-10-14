import type {
  FinishRunInput,
  HelperPlanUsage,
  RegisterRunnerInput,
  Run,
  RunActivity,
  RunAllCardInput,
  RunAllInput,
  RunAllPreview,
  RunAllResult,
  RunBatch,
  RunJob,
  RunLane,
  Runner,
  StartRunInput,
} from '@tracker/shared';
import { segment } from './asking';
import { LabelingClient } from './labeling';

// Runs, batches and helpers, apart from the rest so neither file grows past its limit.
export class RunsClient extends LabelingClient {
  startRun = (ticketKey: string, input: StartRunInput) =>
    this.http.request<Run>('POST', `/api/tickets/${segment(ticketKey)}/runs`, { body: input });

  runAllTodo = (projectKey: string, input: RunAllInput) =>
    this.http.request<RunAllResult>('POST', `/api/projects/${segment(projectKey)}/run-all`, {
      body: input,
    });

  previewRunAll = (projectKey: string) =>
    this.http.request<RunAllPreview>('GET', `/api/projects/${segment(projectKey)}/run-all`);

  getRunBatch = (runId: string) =>
    this.http.request<RunBatch>('GET', `/api/runs/${segment(runId)}/batch`);

  listTicketRuns = (ticketKey: string) =>
    this.http.request<Run[]>('GET', `/api/tickets/${segment(ticketKey)}/runs`);

  listRunActivity = () => this.http.request<RunActivity>('GET', '/api/run-activity');

  getRun = (runId: string) => this.http.request<Run>('GET', `/api/runs/${segment(runId)}`);

  cancelRun = (runId: string) =>
    this.http.request<Run>('POST', `/api/runs/${segment(runId)}/cancel`);

  listRunners = () => this.http.request<Runner[]>('GET', '/api/runners');

  listPlanUsage = () => this.http.request<HelperPlanUsage[]>('GET', '/api/claude-usage');

  removeRunner = (runnerId: string) =>
    this.http.request<void>('DELETE', `/api/runners/${segment(runnerId)}`);

  registerRunner = (runnerId: string, input: RegisterRunnerInput) =>
    this.http.request<Runner>('PUT', `/api/runners/${segment(runnerId)}`, { body: input });

  takeNextRun = (runnerId: string, kind: RunLane) =>
    this.http.request<RunJob | null>(
      'POST',
      `/api/runners/${segment(runnerId)}/next?kind=${kind}&batches=1`,
      { allowEmpty: true },
    );

  finishRun = (runId: string, input: FinishRunInput) =>
    this.http.request<Run>('POST', `/api/runs/${segment(runId)}/finish`, { body: input });

  runAllFromCard = (chatId: string, messageId: string, input: RunAllCardInput) =>
    this.http.request<RunAllResult>(
      'POST',
      `/api/chats/${segment(chatId)}/messages/${segment(messageId)}/run-all`,
      { body: input },
    );
}

import type {
  AddRunRequestInput,
  AddRunStepsInput,
  AnswerRunRequestInput,
  CancelRunRequestInput,
  FinishRunInput,
  HelperPlanUsage,
  ProjectUsage,
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
  RunRequest,
  RunStep,
  StartRunInput,
  WaitRunRequestQuery,
} from '@tracker/shared';
import { segment } from './asking';
import { PromptsClient } from './promptsClient';

// Runs, batches, helpers and what a run asks, apart from the rest so no file grows past its limit.
export class RunsClient extends PromptsClient {
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

  getProjectUsage = (key: string) =>
    this.http.request<ProjectUsage>('GET', `/api/projects/${segment(key)}/usage`);

  addRunSteps = (
    runId: string,
    input: AddRunStepsInput,
    { signal }: { signal?: AbortSignal } = {},
  ) =>
    this.http.request<void>('POST', `/api/runs/${segment(runId)}/steps`, { body: input, signal });

  listRunSteps = (runId: string, { after }: { after?: number } = {}) =>
    this.http.request<RunStep[]>('GET', `/api/runs/${segment(runId)}/steps`, {
      query: { after: after === undefined ? undefined : String(after) },
    });

  addRunRequest = (runId: string, input: AddRunRequestInput) =>
    this.http.request<RunRequest>('POST', `/api/runs/${segment(runId)}/requests`, { body: input });

  listRunRequests = (runId: string) =>
    this.http.request<RunRequest[]>('GET', `/api/runs/${segment(runId)}/requests`);

  answerRunRequest = (requestId: string, input: AnswerRunRequestInput) =>
    this.http.request<RunRequest>('POST', `/api/requests/${segment(requestId)}/answer`, {
      body: input,
    });

  // A long poll: it may answer with the request still open, and is called again then.
  waitForRunRequest = (
    requestId: string,
    { runnerId }: WaitRunRequestQuery,
    { signal }: { signal?: AbortSignal } = {},
  ) =>
    this.http.request<RunRequest>('GET', `/api/requests/${segment(requestId)}/wait`, {
      query: { runnerId },
      signal,
    });

  cancelRunRequest = (
    requestId: string,
    input: CancelRunRequestInput,
    { signal }: { signal?: AbortSignal } = {},
  ) =>
    this.http.request<RunRequest>('POST', `/api/requests/${segment(requestId)}/cancel`, {
      body: input,
      signal,
    });
}

import type {
  Activity,
  ApiToken,
  Attachment,
  CreateApiTokenInput,
  CreatedApiToken,
  CreateCommentInput,
  CreateProjectInput,
  CreateStatusInput,
  CreatedTicket,
  CreateTicketInput,
  ExpectedComment,
  ExpectedFields,
  FinishRunInput,
  ListTicketsQuery,
  LoginInput,
  MarkSentInput,
  MoveTicketInput,
  Project,
  ProjectBoard,
  ProjectDetail,
  ProjectSummary,
  PromptResult,
  RegisterRunnerInput,
  ReportInput,
  ReportPreview,
  ReportResult,
  ReviewInput,
  Run,
  RunJob,
  Runner,
  ServerMeta,
  SessionState,
  StartRunInput,
  Status,
  SubmitWorkInput,
  Ticket,
  TicketDetail,
  TicketListItem,
  TicketsAcrossProjects,
  UpdateCommentInput,
  UpdateProjectInput,
  UpdateStatusInput,
  UpdateTicketInput,
} from '@tracker/shared';
import { Http, type HttpOptions, type ReadOptions } from './http';
import type { UploadOptions } from './upload';

const segment = (value: string): string => encodeURIComponent(value);

const attachmentFilePath = (attachmentId: string): string =>
  `/api/attachments/${segment(attachmentId)}/file`;

const listQuery = (query: ListTicketsQuery) => ({
  status: query.status,
  category: query.category,
  q: query.q,
});

export class TrackerClient {
  private readonly http: Http;

  constructor(options: HttpOptions) {
    this.http = new Http(options);
  }

  listProjects = () => this.http.request<ProjectSummary[]>('GET', '/api/projects');

  createProject = (input: CreateProjectInput) =>
    this.http.request<ProjectDetail>('POST', '/api/projects', { body: input });

  getProject = (key: string) =>
    this.http.request<ProjectDetail>('GET', `/api/projects/${segment(key)}`);

  updateProject = (key: string, input: UpdateProjectInput) =>
    this.http.request<Project>('PATCH', `/api/projects/${segment(key)}`, { body: input });

  deleteProject = (key: string) =>
    this.http.request<void>('DELETE', `/api/projects/${segment(key)}`);

  getBoard = (key: string) =>
    this.http.request<ProjectBoard>('GET', `/api/projects/${segment(key)}/board`);

  getProjectPrompt = (key: string) =>
    this.http.request<PromptResult>('GET', `/api/projects/${segment(key)}/prompt`);

  createStatus = (projectKey: string, input: CreateStatusInput) =>
    this.http.request<Status>('POST', `/api/projects/${segment(projectKey)}/statuses`, {
      body: input,
    });

  updateStatus = (statusId: string, input: UpdateStatusInput) =>
    this.http.request<Status>('PATCH', `/api/statuses/${segment(statusId)}`, { body: input });

  reorderStatuses = (projectKey: string, ids: string[]) =>
    this.http.request<Status[]>('PUT', `/api/projects/${segment(projectKey)}/statuses/order`, {
      body: { ids },
    });

  deleteStatus = (statusId: string, moveTo?: string) =>
    this.http.request<void>('DELETE', `/api/statuses/${segment(statusId)}`, { query: { moveTo } });

  listTickets = (projectKey: string, query: ListTicketsQuery = {}, read: ReadOptions = {}) =>
    this.http.request<TicketListItem[]>('GET', `/api/projects/${segment(projectKey)}/tickets`, {
      query: listQuery(query),
      fresh: read.fresh,
    });

  listAllTickets = (query: ListTicketsQuery = {}) =>
    this.http.request<TicketsAcrossProjects>('GET', '/api/tickets', { query: listQuery(query) });

  createTicket = (projectKey: string, input: CreateTicketInput) =>
    this.http.request<CreatedTicket>('POST', `/api/projects/${segment(projectKey)}/tickets`, {
      body: input,
    });

  getTicket = (ticketKey: string, read: ReadOptions = {}) =>
    this.http.request<TicketDetail>('GET', `/api/tickets/${segment(ticketKey)}`, {
      fresh: read.fresh,
    });

  // `expected`: the text each field was typed over, so the tracker refuses a save that lands after
  // a newer one (409 `stale`).
  updateTicket = (ticketKey: string, input: UpdateTicketInput, expected?: ExpectedFields) =>
    this.http.request<Ticket>('PATCH', `/api/tickets/${segment(ticketKey)}`, {
      body: expected ? { ...input, expected } : input,
    });

  moveTicket = (ticketKey: string, input: MoveTicketInput) =>
    this.http.request<Ticket>('POST', `/api/tickets/${segment(ticketKey)}/move`, { body: input });

  deleteTicket = (ticketKey: string) =>
    this.http.request<void>('DELETE', `/api/tickets/${segment(ticketKey)}`);

  getTicketPrompt = (ticketKey: string) =>
    this.http.request<PromptResult>('GET', `/api/tickets/${segment(ticketKey)}/prompt`);

  markSent = (ticketKey: string, input: MarkSentInput) =>
    this.http.request<Ticket>('POST', `/api/tickets/${segment(ticketKey)}/sent`, { body: input });

  addComment = (ticketKey: string, input: CreateCommentInput) =>
    this.http.request<Activity>('POST', `/api/tickets/${segment(ticketKey)}/comments`, {
      body: input,
    });

  // `expected`: the text the edit was typed over, as for updateTicket.
  updateComment = (activityId: string, input: UpdateCommentInput, expected?: ExpectedComment) =>
    this.http.request<Activity>('PATCH', `/api/activity/${segment(activityId)}`, {
      body: expected ? { ...input, expected } : input,
    });

  deleteActivity = (activityId: string) =>
    this.http.request<void>('DELETE', `/api/activity/${segment(activityId)}`);

  uploadAttachment = (
    file: Blob,
    fileName: string,
    ticketKey?: string,
    options: UploadOptions = {},
  ) =>
    this.http.upload<Attachment>(
      '/api/attachments',
      { blob: file, name: fileName, query: { ticketKey } },
      options,
    );

  deleteAttachment = (attachmentId: string) =>
    this.http.request<void>('DELETE', `/api/attachments/${segment(attachmentId)}`);

  fetchAttachment = (attachmentId: string) => this.http.raw(attachmentFilePath(attachmentId));

  fetchAttachmentText = async (attachmentId: string) =>
    (await this.fetchAttachment(attachmentId)).text();

  attachmentFileUrl = (attachmentId: string) => this.http.url(attachmentFilePath(attachmentId));

  previewReport = (input: ReportInput) =>
    this.http.request<ReportPreview>('POST', '/api/reports/preview', { body: input });

  applyReport = (input: ReportInput) =>
    this.http.request<ReportResult>('POST', '/api/reports/apply', { body: input });

  claimNext = (projectKey: string) =>
    this.http.request<TicketDetail | null>('POST', `/api/projects/${segment(projectKey)}/claim`, {
      allowEmpty: true,
    });

  claimTicket = (ticketKey: string) =>
    this.http.request<TicketDetail>('POST', `/api/tickets/${segment(ticketKey)}/claim`);

  submitForReview = (ticketKey: string, input: SubmitWorkInput) =>
    this.http.request<TicketDetail>('POST', `/api/tickets/${segment(ticketKey)}/submit`, {
      body: input,
    });

  reviewTicket = (ticketKey: string, input: ReviewInput) =>
    this.http.request<TicketDetail>('POST', `/api/tickets/${segment(ticketKey)}/review`, {
      body: input,
    });

  listPeople = () => this.http.request<string[]>('GET', '/api/people');

  getMeta = () => this.http.request<ServerMeta>('GET', '/api/meta');

  // Fresh, so an answer the web app's service worker saved earlier can't stand in for the tracker.
  checkHealth = ({ signal }: { signal?: AbortSignal } = {}) =>
    this.http.request<{ ok: boolean }>('GET', '/api/health', { fresh: true, signal });

  getSession = () => this.http.request<SessionState>('GET', '/api/session');

  login = (input: LoginInput) =>
    this.http.request<SessionState>('POST', '/api/session', { body: input });

  logout = () => this.http.request<SessionState>('DELETE', '/api/session');

  // Ends every session of the owner, this one too. API tokens keep working.
  signOutEverywhere = () => this.http.request<SessionState>('DELETE', '/api/sessions');

  listApiTokens = () => this.http.request<ApiToken[]>('GET', '/api/tokens');

  createApiToken = (input: CreateApiTokenInput) =>
    this.http.request<CreatedApiToken>('POST', '/api/tokens', { body: input });

  revokeApiToken = (id: string) => this.http.request<void>('DELETE', `/api/tokens/${segment(id)}`);

  // A person starts Claude Code on one of their own helpers; the helper's side follows.
  startRun = (ticketKey: string, input: StartRunInput) =>
    this.http.request<Run>('POST', `/api/tickets/${segment(ticketKey)}/runs`, { body: input });

  listTicketRuns = (ticketKey: string) =>
    this.http.request<Run[]>('GET', `/api/tickets/${segment(ticketKey)}/runs`);

  getRun = (runId: string) => this.http.request<Run>('GET', `/api/runs/${segment(runId)}`);

  cancelRun = (runId: string) =>
    this.http.request<Run>('POST', `/api/runs/${segment(runId)}/cancel`);

  listRunners = () => this.http.request<Runner[]>('GET', '/api/runners');

  removeRunner = (runnerId: string) =>
    this.http.request<void>('DELETE', `/api/runners/${segment(runnerId)}`);

  registerRunner = (runnerId: string, input: RegisterRunnerInput) =>
    this.http.request<Runner>('PUT', `/api/runners/${segment(runnerId)}`, { body: input });

  takeNextRun = (runnerId: string) =>
    this.http.request<RunJob | null>('POST', `/api/runners/${segment(runnerId)}/next`, {
      allowEmpty: true,
    });

  finishRun = (runId: string, input: FinishRunInput) =>
    this.http.request<Run>('POST', `/api/runs/${segment(runId)}/finish`, { body: input });

  eventsUrl = () => this.http.url('/api/events');
}

import type {
  Activity,
  Attachment,
  CreateCommentInput,
  CreateProjectInput,
  CreateStatusInput,
  CreateTicketInput,
  ListTicketsQuery,
  MarkSentInput,
  MoveTicketInput,
  Project,
  ProjectBoard,
  ProjectDetail,
  ProjectSummary,
  PromptResult,
  ReportInput,
  ReportPreview,
  ReportResult,
  ReviewInput,
  ServerMeta,
  SessionState,
  Status,
  SubmitWorkInput,
  Ticket,
  TicketDetail,
  TicketListItem,
  UpdateCommentInput,
  UpdateProjectInput,
  UpdateStatusInput,
  UpdateTicketInput,
} from '@tracker/shared';
import { Http, type HttpOptions, type ReadOptions } from './http';

const segment = (value: string): string => encodeURIComponent(value);

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
    this.http.request<TicketListItem[]>('GET', '/api/tickets', { query: listQuery(query) });

  createTicket = (projectKey: string, input: CreateTicketInput) =>
    this.http.request<Ticket>('POST', `/api/projects/${segment(projectKey)}/tickets`, {
      body: input,
    });

  getTicket = (ticketKey: string, read: ReadOptions = {}) =>
    this.http.request<TicketDetail>('GET', `/api/tickets/${segment(ticketKey)}`, {
      fresh: read.fresh,
    });

  updateTicket = (ticketKey: string, input: UpdateTicketInput) =>
    this.http.request<Ticket>('PATCH', `/api/tickets/${segment(ticketKey)}`, { body: input });

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

  updateComment = (activityId: string, input: UpdateCommentInput) =>
    this.http.request<Activity>('PATCH', `/api/activity/${segment(activityId)}`, { body: input });

  deleteActivity = (activityId: string) =>
    this.http.request<void>('DELETE', `/api/activity/${segment(activityId)}`);

  uploadAttachment = (file: Blob, fileName: string, ticketKey?: string) => {
    const form = new FormData();
    form.set('file', file, fileName);
    if (ticketKey) form.set('ticketKey', ticketKey);
    return this.http.request<Attachment>('POST', '/api/attachments', { body: form });
  };

  deleteAttachment = (attachmentId: string) =>
    this.http.request<void>('DELETE', `/api/attachments/${segment(attachmentId)}`);

  fetchAttachment = (attachmentId: string) =>
    this.http.raw(`/api/attachments/${segment(attachmentId)}/file`);

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

  getSession = () => this.http.request<SessionState>('GET', '/api/session');

  login = (token: string) =>
    this.http.request<SessionState>('POST', '/api/session', { body: { token } });

  eventsUrl = () => this.http.url('/api/events');
}

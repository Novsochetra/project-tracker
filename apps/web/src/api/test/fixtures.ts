import {
  DEFAULT_STATUSES,
  HUMAN,
  type Activity,
  type Attachment,
  type Project,
  type ProjectBoard,
  type ProjectSummary,
  type Status,
  type TicketDetail,
  type TicketListItem,
} from '@tracker/shared';

export const project: Project = {
  id: 'p-mob',
  name: 'Mobile app',
  key: 'MOB',
  description: '',
  repo: '~/code/mobile-app',
  color: '#5B5BD6',
  nextNum: 5,
  createdAt: 1,
  updatedAt: 1,
};

export const otherProject: Project = { ...project, id: 'p-web', name: 'Website', key: 'WEB' };

export const STATUS = {
  todo: 's-todo',
  progress: 's-progress',
  review: 's-review',
  reviewed: 's-reviewed',
  done: 's-done',
} as const;

const STATUS_IDS = Object.values(STATUS);

export const statuses: Status[] = DEFAULT_STATUSES.map((template, index) => ({
  ...template,
  id: STATUS_IDS[index] ?? `s-${index}`,
  projectId: project.id,
  position: index,
  createdAt: 1,
}));

export const summaryOf = (value: Project): ProjectSummary => ({
  ...value,
  totalCount: 4,
  openCount: 3,
  doneCount: 1,
  reviewedCount: 0,
  lastActivityAt: 1,
});

export function listItem(
  num: number,
  statusId: string,
  rank: number,
  overrides: Partial<TicketListItem> = {},
): TicketListItem {
  return {
    id: `t-${num}`,
    projectId: project.id,
    num,
    key: `MOB-${num}`,
    statusId,
    rank,
    title: `Ticket ${num}`,
    description: '',
    priority: 'medium',
    assignee: '',
    due: '',
    needsDevice: false,
    createdAt: 1,
    updatedAt: 1,
    commentCount: 0,
    attachmentCount: 0,
    lastReview: null,
    waitingUntil: null,
    ...overrides,
  };
}

export const defaultTickets = (): TicketListItem[] => [
  listItem(1, STATUS.todo, 0),
  listItem(2, STATUS.todo, 1000),
  listItem(3, STATUS.progress, 0),
  listItem(4, STATUS.done, 0),
];

export const makeBoard = (tickets: TicketListItem[] = defaultTickets()): ProjectBoard => ({
  project,
  statuses,
  tickets,
});

export function attachment(id: string, overrides: Partial<Attachment> = {}): Attachment {
  return {
    id,
    ticketId: 't-1',
    activityId: null,
    fileName: `${id}.png`,
    mimeType: 'image/png',
    size: 100,
    width: 10,
    height: 10,
    url: `/api/attachments/${id}/file`,
    createdAt: 1,
    ...overrides,
  };
}

export function comment(id: string, text: string, overrides: Partial<Activity> = {}): Activity {
  return {
    id,
    ticketId: 't-1',
    type: 'comment',
    actor: HUMAN,
    text,
    review: null,
    attachments: [],
    createdAt: 1,
    editedAt: null,
    ...overrides,
  };
}

export function makeTicketDetail(
  item: TicketListItem = listItem(1, STATUS.todo, 0),
  overrides: Partial<TicketDetail> = {},
): TicketDetail {
  const { commentCount: _comments, attachmentCount: _attachments, ...ticket } = item;
  const status = statuses.find((candidate) => candidate.id === ticket.statusId) ?? statuses[0]!;
  return { ticket, project, status, statuses, activity: [], attachments: [], ...overrides };
}

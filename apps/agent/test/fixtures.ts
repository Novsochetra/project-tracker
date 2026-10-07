import {
  DEFAULT_STATUSES,
  type Activity,
  type Attachment,
  type ProjectSummary,
  type Status,
  type TicketDetail,
  type TicketListItem,
} from '@tracker/shared';

export const at = (day: number, hour: number, minute = 0): number =>
  new Date(2026, 9, day, hour, minute).getTime();

const T0 = at(2, 9);

export const projectSummary = (overrides: Partial<ProjectSummary> = {}): ProjectSummary => ({
  id: 'p1',
  name: 'Mobile app',
  key: 'MOB',
  description: '',
  repo: '',
  color: '#5B5BD6',
  nextNum: 4,
  createdAt: T0,
  updatedAt: T0,
  totalCount: 7,
  openCount: 3,
  doneCount: 4,
  lastActivityAt: T0,
  ...overrides,
});

export const statuses = (): Status[] =>
  DEFAULT_STATUSES.map((status, index) => ({
    id: `s${index + 1}`,
    projectId: 'p1',
    name: status.name,
    category: status.category,
    color: status.color,
    position: index,
    createdAt: T0,
  }));

export const statusAt = (index: number): Status => statuses()[index]!;

export const ticket = (overrides: Partial<TicketListItem> = {}): TicketListItem => ({
  id: 't3',
  projectId: 'p1',
  num: 3,
  key: 'MOB-3',
  statusId: 's1',
  rank: 0,
  title: 'Crash when rotating the profile screen',
  description: '',
  priority: 'high',
  assignee: '',
  due: '',
  createdAt: T0,
  updatedAt: T0,
  commentCount: 0,
  attachmentCount: 0,
  ...overrides,
});

export const attachment = (overrides: Partial<Attachment> = {}): Attachment => ({
  id: 'a1',
  ticketId: 't3',
  activityId: null,
  fileName: 'screenshot.png',
  mimeType: 'image/png',
  size: 1200,
  width: 1170,
  height: 2532,
  url: '/api/attachments/a1/file',
  createdAt: T0,
  ...overrides,
});

export const activity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'act1',
  ticketId: 't3',
  type: 'event',
  actor: { kind: 'human', name: '' },
  text: 'created the ticket',
  review: null,
  attachments: [],
  createdAt: at(2, 14, 5),
  editedAt: null,
  ...overrides,
});

export const detail = (overrides: Partial<TicketDetail> = {}): TicketDetail => {
  const {
    totalCount: _t,
    openCount: _o,
    doneCount: _d,
    lastActivityAt: _l,
    ...project
  } = projectSummary();
  return {
    ticket: ticket(),
    project,
    status: statusAt(0),
    statuses: statuses(),
    activity: [],
    attachments: [],
    ...overrides,
  };
};

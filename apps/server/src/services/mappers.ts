import {
  formatTicketKey,
  type Activity,
  type Attachment,
  type Project,
  type Review,
  type ReviewVerdict,
  type Status,
  type Ticket,
  type TicketListItem,
} from '@tracker/shared';
import type { ActivityRow, AttachmentRow, ProjectRow, StatusRow, TicketRow } from '../db/schema';
import type { TicketItemRow } from '../repositories/tickets';

export const attachmentUrl = (id: string): string => `/api/attachments/${id}/file`;

export const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name,
  key: row.key,
  description: row.description,
  repo: row.repo,
  instructions: row.instructions,
  color: row.color,
  nextNum: row.nextNum,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  autoReview: row.autoReview === 1,
});

export const toStatus = (row: StatusRow): Status => ({
  id: row.id,
  projectId: row.projectId,
  name: row.name,
  category: row.category,
  color: row.color,
  position: row.position,
  createdAt: row.createdAt,
});

export const toTicket = (row: TicketRow, projectKey: string): Ticket => ({
  id: row.id,
  projectId: row.projectId,
  num: row.num,
  key: formatTicketKey(projectKey, row.num),
  statusId: row.statusId,
  rank: row.rank,
  title: row.title,
  description: row.description,
  priority: row.priority,
  assignee: row.assignee,
  due: row.due,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toReview = (verdict: ReviewVerdict | null, rating: number | null): Review | null =>
  verdict ? { verdict, rating: rating ?? 0 } : null;

export const toTicketListItem = (row: TicketItemRow, projectKey: string): TicketListItem => ({
  ...toTicket(row, projectKey),
  commentCount: row.commentCount,
  attachmentCount: row.attachmentCount,
  lastReview: toReview(row.lastReviewVerdict, row.lastReviewRating),
  waitingUntil: row.waitingUntil,
});

export const toAttachment = (row: AttachmentRow): Attachment => ({
  id: row.id,
  ticketId: row.ticketId,
  activityId: row.activityId,
  fileName: row.fileName,
  mimeType: row.mimeType,
  size: row.size,
  width: row.width,
  height: row.height,
  url: attachmentUrl(row.id),
  createdAt: row.createdAt,
});

export const toActivity = (row: ActivityRow, attachments: readonly AttachmentRow[]): Activity => ({
  id: row.id,
  ticketId: row.ticketId,
  type: row.type,
  actor: { kind: row.actorKind, name: row.actorName },
  text: row.text,
  review: toReview(row.reviewVerdict, row.reviewRating),
  attachments: attachments.map(toAttachment),
  createdAt: row.createdAt,
  editedAt: row.editedAt,
});

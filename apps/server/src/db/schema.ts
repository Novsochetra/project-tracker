import type {
  ActivityType,
  ActorKind,
  Priority,
  ReviewVerdict,
  StatusCategory,
} from '@tracker/shared';
import type { Kysely } from 'kysely';
import type { AuthTables } from './authTables';

export interface ProjectRow {
  id: string;
  name: string;
  key: string;
  description: string;
  repo: string;
  color: string;
  nextNum: number;
  createdAt: number;
  updatedAt: number;
}

export interface StatusRow {
  id: string;
  projectId: string;
  name: string;
  category: StatusCategory;
  color: string;
  position: number;
  createdAt: number;
}

export interface TicketRow {
  id: string;
  projectId: string;
  num: number;
  statusId: string;
  rank: number;
  title: string;
  description: string;
  priority: Priority;
  assignee: string;
  due: string;
  createdAt: number;
  updatedAt: number;
  clientId: string | null;
}

export interface ActivityRow {
  id: string;
  ticketId: string;
  type: ActivityType;
  actorKind: ActorKind;
  actorName: string;
  text: string;
  reviewVerdict: ReviewVerdict | null;
  reviewRating: number | null;
  createdAt: number;
  editedAt: number | null;
}

export interface AttachmentRow {
  id: string;
  ticketId: string | null;
  activityId: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  storageKey: string;
  // Where it lists among its ticket's or comment's files (then by createdAt).
  position: number;
  createdAt: number;
}

export interface Database extends AuthTables {
  projects: ProjectRow;
  statuses: StatusRow;
  tickets: TicketRow;
  activities: ActivityRow;
  attachments: AttachmentRow;
}

export type Db = Kysely<Database>;

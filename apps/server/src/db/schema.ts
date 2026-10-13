import type {
  ActivityType,
  ActorKind,
  Priority,
  ReviewVerdict,
  StatusCategory,
} from '@tracker/shared';
import type { Kysely } from 'kysely';
import type { AuthTables } from './authTables';
import type { ChatTables } from './chatTables';
import type { PushTables } from './pushTables';
import type { QuestionTables } from './questionTables';
import type { RunTables } from './runTables';

export interface ProjectRow {
  id: string;
  name: string;
  key: string;
  description: string;
  repo: string;
  instructions: string;
  color: string;
  nextNum: number;
  createdAt: number;
  updatedAt: number;
  // Null only on a tracker without an owner yet (services/lookups.ts).
  ownerId: string | null;
  // 1 when on; 0 or null (projects from before it) when off. No booleans (§2).
  autoReview: number | null;
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
  // Who uploaded it: a file on no ticket yet is only theirs.
  userId: string | null;
  // A file sent in a chat is on no ticket, yet it isn't pending (PT-187).
  chatMessageId: string | null;
}

export interface Database extends AuthTables, ChatTables, PushTables, QuestionTables, RunTables {
  projects: ProjectRow;
  statuses: StatusRow;
  tickets: TicketRow;
  activities: ActivityRow;
  attachments: AttachmentRow;
}

export type Db = Kysely<Database>;

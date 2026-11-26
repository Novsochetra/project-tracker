import type {
  ActivityType,
  ActorKind,
  Priority,
  ReviewVerdict,
  StatusCategory,
} from '@tracker/shared';
import type { Kysely } from 'kysely';
import type { AuthTables } from './authTables';
import type { LabelTables } from './labelTables';
import type { PushTables } from './pushTables';
import type { QuestionTables } from './questionTables';

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
  hideName: number;
  // The person's order of their projects (PT-260); ties, such as every project before it, go by
  // created_at.
  position: number;
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
  // line_run_id, line_path, line_side and line_number, the line of a run's changes a comment was
  // on, stay in the table, unread, until a later release drops them (§2.1).
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
}

// The tables of the features that ran Claude Code (runs, chats and the rest) and the columns only
// they read stay in the database, unread, until a later release drops them (§2.1).
export interface Database extends AuthTables, LabelTables, PushTables, QuestionTables {
  projects: ProjectRow;
  statuses: StatusRow;
  tickets: TicketRow;
  activities: ActivityRow;
  attachments: AttachmentRow;
}

export type Db = Kysely<Database>;

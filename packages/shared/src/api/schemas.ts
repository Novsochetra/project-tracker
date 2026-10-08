import { z } from 'zod';
import { REVIEW_VERDICTS } from '../domain/activity';
import {
  MAX_NEW_ATTACHMENTS,
  tooManyFilesMessage,
  type AttachmentOwner,
} from '../domain/attachment';
import { PRIORITIES } from '../domain/priority';
import { STATUS_CATEGORIES } from '../domain/status';
import { toYmd } from '../logic/format';

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a hex color like #5B5BD6');
const isRealDay = (ymd: string): boolean => toYmd(new Date(`${ymd}T00:00:00`)) === ymd;
const dueDate = z.union([
  z.literal(''),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isRealDay, 'Use a real date like 2026-10-09'),
]);
const id = z.string().min(1).max(64);
const attachmentIds = (owner: AttachmentOwner) =>
  z.array(id).max(MAX_NEW_ATTACHMENTS, tooManyFilesMessage(owner));

export const createProjectInput = z.object({
  name: z.string().trim().min(1, 'Add a name to create the project.').max(120),
  key: z.string().max(20).optional(),
  description: z.string().max(5000).optional(),
  repo: z.string().trim().max(500).optional(),
});
export type CreateProjectInput = z.input<typeof createProjectInput>;

export const updateProjectInput = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(5000).optional(),
  repo: z.string().trim().max(500).optional(),
});
export type UpdateProjectInput = z.input<typeof updateProjectInput>;

export const createStatusInput = z.object({
  name: z.string().trim().min(1).max(40),
  category: z.enum(STATUS_CATEGORIES),
  color: hexColor.optional(),
});
export type CreateStatusInput = z.input<typeof createStatusInput>;

export const updateStatusInput = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  category: z.enum(STATUS_CATEGORIES).optional(),
  color: hexColor.optional(),
});
export type UpdateStatusInput = z.input<typeof updateStatusInput>;

export const reorderStatusesInput = z.object({ ids: z.array(id).min(1) });
export type ReorderStatusesInput = z.input<typeof reorderStatusesInput>;

export const createTicketInput = z.object({
  title: z.string().trim().min(1, 'Add a title to create the ticket.').max(300),
  description: z.string().max(50_000).default(''),
  statusId: id.optional(),
  priority: z.enum(PRIORITIES).default('medium'),
  assignee: z.string().trim().max(80).default(''),
  due: dueDate.default(''),
  attachmentIds: attachmentIds('ticket').default([]),
  // From a client that may send the same create again: a repeat gets the ticket the first one made.
  clientId: id.optional(),
});
export type CreateTicketInput = z.input<typeof createTicketInput>;

export const updateTicketInput = z.object({
  title: z.string().max(300).optional(),
  description: z.string().max(50_000).optional(),
  statusId: id.optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignee: z.string().trim().max(80).optional(),
  due: dueDate.optional(),
});
export type UpdateTicketInput = z.input<typeof updateTicketInput>;

export const moveTicketInput = z.object({
  statusId: id,
  beforeId: id.nullable().optional(),
  afterId: id.nullable().optional(),
});
export type MoveTicketInput = z.input<typeof moveTicketInput>;

export const markSentInput = z.object({ moveToInProgress: z.boolean().default(false) });
export type MarkSentInput = z.input<typeof markSentInput>;

export const createCommentInput = z
  .object({
    text: z.string().max(20_000).default(''),
    attachmentIds: attachmentIds('comment').default([]),
  })
  .refine((v) => v.text.trim().length > 0 || v.attachmentIds.length > 0, {
    message: 'Write a comment or add a file.',
  });
export type CreateCommentInput = z.input<typeof createCommentInput>;

export const updateCommentInput = z.object({ text: z.string().trim().min(1).max(20_000) });
export type UpdateCommentInput = z.input<typeof updateCommentInput>;

export const reportInput = z.object({
  text: z.string().max(100_000),
  ticketKey: z.string().max(40).optional(),
});
export type ReportInput = z.input<typeof reportInput>;

export const submitWorkInput = z.object({
  summary: z.string().trim().min(1).max(20_000),
  files: z.string().max(20_000).default(''),
  next: z.string().max(20_000).default(''),
});
export type SubmitWorkInput = z.input<typeof submitWorkInput>;

export const reviewInput = z.object({
  verdict: z.enum(REVIEW_VERDICTS),
  rating: z.number().int().min(1).max(5),
  summary: z.string().trim().min(1).max(20_000),
});
export type ReviewInput = z.input<typeof reviewInput>;

export const listTicketsQuery = z.object({
  status: z.string().max(40).optional(),
  category: z.enum(STATUS_CATEGORIES).optional(),
  q: z.string().max(200).optional(),
});
export type ListTicketsQuery = z.input<typeof listTicketsQuery>;

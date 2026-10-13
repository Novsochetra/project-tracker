import { z } from 'zod';
import { COMMENT_TEXT_MAX, REPORT_TEXT_MAX, REVIEW_VERDICTS } from '../domain/activity';
import {
  MAX_NEW_ATTACHMENTS,
  tooManyFilesMessage,
  type AttachmentOwner,
} from '../domain/attachment';
import { LABEL_INSTRUCTIONS_MAX, LABEL_NAME_MAX, LABEL_TEMPLATE_MAX } from '../domain/label';
import { PRIORITIES } from '../domain/priority';
import { PROJECT_INSTRUCTIONS_MAX } from '../domain/project';
import { DEFAULT_PROJECT_TEMPLATE, PROJECT_TEMPLATE_NAMES } from '../domain/projectTemplates';
import { STATUS_CATEGORIES } from '../domain/status';
import {
  TICKET_ASSIGNEE_MAX,
  TICKET_DESCRIPTION_MAX,
  TICKET_SEARCH_MAX,
  TICKET_TITLE_MAX,
} from '../domain/ticket';
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

const projectInstructions = z
  .string()
  .trim()
  .max(
    PROJECT_INSTRUCTIONS_MAX,
    `Instructions can be up to ${PROJECT_INSTRUCTIONS_MAX.toLocaleString('en-US')} characters.`,
  )
  .optional();

export const createProjectInput = z.object({
  name: z.string().trim().min(1, 'Add a name to create the project.').max(120),
  key: z.string().max(20).optional(),
  description: z.string().max(5000).optional(),
  repo: z.string().trim().max(500).optional(),
  instructions: projectInstructions,
  template: z.enum(PROJECT_TEMPLATE_NAMES).default(DEFAULT_PROJECT_TEMPLATE),
});
export type CreateProjectInput = z.input<typeof createProjectInput>;

export const updateProjectInput = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(5000).optional(),
  repo: z.string().trim().max(500).optional(),
  instructions: projectInstructions,
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

const labelName = z.string().trim().min(1).max(LABEL_NAME_MAX);
const labelTemplate = z
  .string()
  .max(LABEL_TEMPLATE_MAX, 'A template can be up to 20,000 characters.');
const labelInstructions = z
  .string()
  .trim()
  .max(LABEL_INSTRUCTIONS_MAX, 'Instructions can be up to 20,000 characters.');

export const createLabelInput = z.object({
  name: labelName,
  color: hexColor.optional(),
  template: labelTemplate.default(''),
  instructions: labelInstructions.default(''),
});
export type CreateLabelInput = z.input<typeof createLabelInput>;

export const updateLabelInput = z.object({
  name: labelName.optional(),
  color: hexColor.optional(),
  template: labelTemplate.optional(),
  instructions: labelInstructions.optional(),
});
export type UpdateLabelInput = z.input<typeof updateLabelInput>;

export const reorderLabelsInput = z.object({ ids: z.array(id).min(1) });
export type ReorderLabelsInput = z.input<typeof reorderLabelsInput>;

// A ticket's whole set of labels, which replaces the one it had.
const labelIds = z.array(id).max(50);

export const createTicketInput = z.object({
  title: z.string().trim().min(1, 'Add a title to create the ticket.').max(TICKET_TITLE_MAX),
  description: z.string().max(TICKET_DESCRIPTION_MAX).default(''),
  statusId: id.optional(),
  priority: z.enum(PRIORITIES).default('medium'),
  assignee: z.string().trim().max(TICKET_ASSIGNEE_MAX).default(''),
  due: dueDate.default(''),
  attachmentIds: attachmentIds('ticket').default([]),
  labelIds: labelIds.default([]),
  // From a client that may send the same create again: a repeat gets the ticket the first one made.
  clientId: id.optional(),
});
export type CreateTicketInput = z.input<typeof createTicketInput>;

export const updateTicketInput = z.object({
  title: z.string().max(TICKET_TITLE_MAX).optional(),
  description: z.string().max(TICKET_DESCRIPTION_MAX).optional(),
  statusId: id.optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignee: z.string().trim().max(TICKET_ASSIGNEE_MAX).optional(),
  due: dueDate.optional(),
  labelIds: labelIds.optional(),
});
export type UpdateTicketInput = z.input<typeof updateTicketInput>;

// The text a save was typed over, per field. The tracker refuses the save (409 `stale`) when a
// field it changes has other text now, so an older save that lands late can't overwrite a newer
// one. Agents send none.
export const expectedFields = z.object({
  title: z.string().max(TICKET_TITLE_MAX).optional(),
  description: z.string().max(TICKET_DESCRIPTION_MAX).optional(),
  assignee: z.string().trim().max(TICKET_ASSIGNEE_MAX).optional(),
});
export type ExpectedFields = z.input<typeof expectedFields>;

export const updateTicketRequest = updateTicketInput.extend({
  expected: expectedFields.optional(),
});

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
    text: z.string().max(COMMENT_TEXT_MAX).default(''),
    attachmentIds: attachmentIds('comment').default([]),
  })
  .refine((v) => v.text.trim().length > 0 || v.attachmentIds.length > 0, {
    message: 'Write a comment or add a file.',
  });
export type CreateCommentInput = z.input<typeof createCommentInput>;

export const updateCommentInput = z.object({
  text: z.string().trim().min(1).max(COMMENT_TEXT_MAX),
});
export type UpdateCommentInput = z.input<typeof updateCommentInput>;

// The text an edit was typed over. The tracker refuses the edit (409 `stale`) once the comment has
// other text, as for ticket fields (expectedFields). Agents send none.
export const expectedComment = z.object({
  text: z.string().trim().max(COMMENT_TEXT_MAX),
});
export type ExpectedComment = z.input<typeof expectedComment>;

export const updateCommentRequest = updateCommentInput.extend({
  expected: expectedComment.optional(),
});

export const reportInput = z.object({
  text: z.string().max(100_000),
  ticketKey: z.string().max(40).optional(),
});
export type ReportInput = z.input<typeof reportInput>;

export const submitWorkInput = z.object({
  summary: z.string().trim().min(1).max(REPORT_TEXT_MAX),
  files: z.string().max(REPORT_TEXT_MAX).default(''),
  next: z.string().max(REPORT_TEXT_MAX).default(''),
});
export type SubmitWorkInput = z.input<typeof submitWorkInput>;

export const reviewInput = z.object({
  verdict: z.enum(REVIEW_VERDICTS),
  rating: z.number().int().min(1).max(5),
  summary: z.string().trim().min(1).max(REPORT_TEXT_MAX),
});
export type ReviewInput = z.input<typeof reviewInput>;

export const listTicketsQuery = z.object({
  status: z.string().max(40).optional(),
  category: z.enum(STATUS_CATEGORIES).optional(),
  q: z.string().max(TICKET_SEARCH_MAX).optional(),
  // A label's name, case-insensitive, as for a status.
  label: z.string().max(LABEL_NAME_MAX).optional(),
});
export type ListTicketsQuery = z.input<typeof listTicketsQuery>;

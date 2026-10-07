import { PRIORITIES, REVIEW_VERDICTS, STATUS_CATEGORIES } from '@tracker/shared';
import { z } from 'zod';

export const TICKET_KEY = /^[A-Za-z0-9]+-\d+$/;

export const projectKey = z
  .string()
  .trim()
  .min(1, 'Pass a project key like MOB.')
  .toUpperCase()
  .describe('Project key (the ticket prefix), e.g. "MOB". list_projects shows every key.');

export const ticketKey = z
  .string()
  .trim()
  .regex(TICKET_KEY, 'Use a ticket key like MOB-3.')
  .toUpperCase()
  .describe('Ticket key, e.g. "MOB-3".');

export const statusName = z
  .string()
  .trim()
  .min(1, 'Pass a status name like "In progress".')
  .describe('Status name, case-insensitive, e.g. "In progress". list_statuses shows every name.');

export const category = z
  .enum(STATUS_CATEGORIES)
  .describe('Status category: todo, in_progress, in_review, reviewed or done.');

export const priority = z.enum(PRIORITIES).describe('Priority: high, medium or low.');

export const title = z.string().trim().min(1, 'The title cannot be empty.').max(300);

export const verdict = z.enum(REVIEW_VERDICTS).describe('"approved" or "changes_requested".');

const RATING_ERROR = 'Rating must be a whole number from 1 to 5.';

export const rating = z
  .number({ error: RATING_ERROR })
  .int(RATING_ERROR)
  .min(1, RATING_ERROR)
  .max(5, RATING_ERROR);

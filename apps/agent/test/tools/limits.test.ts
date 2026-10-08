import {
  COMMENT_TEXT_MAX,
  createCommentInput,
  createTicketInput,
  REPORT_TEXT_MAX,
  reviewInput,
  submitWorkInput,
  TICKET_ASSIGNEE_MAX,
  TICKET_DESCRIPTION_MAX,
  TICKET_TITLE_MAX,
  updateTicketInput,
} from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { addComment } from '../../src/tools/addComment';
import { createTicket } from '../../src/tools/createTicket';
import { reviewTicket } from '../../src/tools/reviewTicket';
import { submitForReview } from '../../src/tools/submitForReview';
import type { Tool } from '../../src/tools/tool';
import { updateTicket } from '../../src/tools/updateTicket';

function maxLength(schema: unknown): number | null {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return maxLength(schema.unwrap());
  }
  return schema instanceof z.ZodString ? schema.maxLength : null;
}

// Each tool field, the API input it is sent in (under the same name), and the shared limit.
const FIELDS: Array<[Tool, string, z.ZodObject, number]> = [
  [createTicket, 'title', createTicketInput, TICKET_TITLE_MAX],
  [createTicket, 'description', createTicketInput, TICKET_DESCRIPTION_MAX],
  [updateTicket, 'title', updateTicketInput, TICKET_TITLE_MAX],
  [updateTicket, 'description', updateTicketInput, TICKET_DESCRIPTION_MAX],
  [updateTicket, 'assignee', updateTicketInput, TICKET_ASSIGNEE_MAX],
  [addComment, 'text', createCommentInput, COMMENT_TEXT_MAX],
  [submitForReview, 'summary', submitWorkInput, REPORT_TEXT_MAX],
  [submitForReview, 'files', submitWorkInput, REPORT_TEXT_MAX],
  [submitForReview, 'next', submitWorkInput, REPORT_TEXT_MAX],
  [reviewTicket, 'summary', reviewInput, REPORT_TEXT_MAX],
];

describe('MCP tool text limits', () => {
  for (const [tool, field, api, limit] of FIELDS) {
    it(`${tool.name} takes as much ${field} as the API, the shared limit`, () => {
      expect(maxLength(tool.input.shape[field])).toBe(limit);
      expect(maxLength(api.shape[field])).toBe(limit);
    });
  }

  it('refuses a comment one character past the shared limit, like the API', () => {
    const comment = (length: number) => ({ ticket: 'MOB-3', text: 'x'.repeat(length) });
    expect(addComment.input.safeParse(comment(COMMENT_TEXT_MAX)).success).toBe(true);
    expect(addComment.input.safeParse(comment(COMMENT_TEXT_MAX + 1)).success).toBe(false);
  });
});

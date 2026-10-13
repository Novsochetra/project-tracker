import {
  COMMENT_TEXT_MAX,
  createCommentInput,
  createTicketInput,
  listTicketsQuery,
  REPORT_TEXT_MAX,
  reviewInput,
  submitWorkInput,
  TICKET_ASSIGNEE_MAX,
  TICKET_DESCRIPTION_MAX,
  TICKET_SEARCH_MAX,
  TICKET_TITLE_MAX,
  updateTicketInput,
} from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { addComment } from '../../src/tools/addComment';
import { attachFile } from '../../src/tools/attachFile';
import { createTicket } from '../../src/tools/createTicket';
import { listTickets } from '../../src/tools/listTickets';
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
  [submitForReview, 'output', submitWorkInput, REPORT_TEXT_MAX],
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

  it('list_tickets takes as long a query as the API, the shared limit', () => {
    expect(maxLength(listTickets.input.shape.query)).toBe(TICKET_SEARCH_MAX);
    expect(maxLength(listTicketsQuery.shape.q)).toBe(TICKET_SEARCH_MAX);
  });

  it("attach_file takes as long a comment as the API takes a comment's text", () => {
    expect(maxLength(attachFile.input.shape.comment)).toBe(COMMENT_TEXT_MAX);
    expect(maxLength(createCommentInput.shape.text)).toBe(COMMENT_TEXT_MAX);
  });

  it('refuses a comment one character past the shared limit, like the API', () => {
    const comment = (length: number) => ({ ticket: 'MOB-3', text: 'x'.repeat(length) });
    expect(addComment.input.safeParse(comment(COMMENT_TEXT_MAX)).success).toBe(true);
    expect(addComment.input.safeParse(comment(COMMENT_TEXT_MAX + 1)).success).toBe(false);
  });
});

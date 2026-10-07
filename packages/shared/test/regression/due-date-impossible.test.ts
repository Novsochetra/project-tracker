import { describe, expect, it } from 'vitest';
import { createTicketInput, updateTicketInput } from '../../src/api/schemas';

describe('regression: impossible due dates are rejected', () => {
  it.each(['2026-02-31', '2026-13-01', '2026-00-10', '2026-04-31'])('rejects %s', (due) => {
    expect(createTicketInput.safeParse({ title: 'A', due }).success).toBe(false);
    expect(updateTicketInput.safeParse({ due }).success).toBe(false);
  });

  it.each(['', '2026-02-28', '2028-02-29', '2026-12-31'])('accepts %s', (due) => {
    expect(createTicketInput.safeParse({ title: 'A', due }).success).toBe(true);
  });
});

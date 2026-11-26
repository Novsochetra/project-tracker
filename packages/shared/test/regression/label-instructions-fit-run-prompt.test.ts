import { describe, expect, it } from 'vitest';
import {
  createLabelInput,
  createTicketInput,
  updateLabelInput,
  updateTicketInput,
} from '../../src/api/schemas';
import { LABEL_INSTRUCTIONS_MAX, TICKET_LABELS_MAX } from '../../src/domain/label';

// PT-190 review: 50 labels of 20,000 characters each let a ticket's prompt pass the 100,000 a run
// took, and the run was refused without saying why. The limits stay, so what an agent reads of a
// ticket's labels stays bounded.
describe('regression: a ticket’s label instructions stay bounded', () => {
  it('refuses longer label instructions, saying the limit', () => {
    const instructions = 'x'.repeat(LABEL_INSTRUCTIONS_MAX + 1);
    const message = 'Instructions can be up to 4,000 characters.';
    expect(
      createLabelInput.safeParse({ name: 'Bug', instructions }).error?.issues[0]?.message,
    ).toBe(message);
    expect(updateLabelInput.safeParse({ instructions }).error?.issues[0]?.message).toBe(message);
  });

  it('refuses more labels on a new ticket, saying the limit', () => {
    const labelIds = Array.from({ length: TICKET_LABELS_MAX + 1 }, (_, index) => `l-${index}`);
    const message = 'A ticket can have up to 10 labels.';
    expect(createTicketInput.safeParse({ title: 'A', labelIds }).error?.issues[0]?.message).toBe(
      message,
    );
    expect(createTicketInput.safeParse({ title: 'A', labelIds: labelIds.slice(1) }).success).toBe(
      true,
    );
  });

  // The tracker holds an edit to the cap against the ticket's own labels, which may be more.
  it('leaves an edit up to the 50 a ticket could have before', () => {
    const labelIds = Array.from({ length: 51 }, (_, index) => `l-${index}`);
    expect(updateTicketInput.safeParse({ labelIds: labelIds.slice(1) }).success).toBe(true);
    expect(updateTicketInput.safeParse({ labelIds }).success).toBe(false);
  });
});

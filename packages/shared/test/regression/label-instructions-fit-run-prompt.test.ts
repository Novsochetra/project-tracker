import { describe, expect, it } from 'vitest';
import {
  createLabelInput,
  createTicketInput,
  updateLabelInput,
  updateTicketInput,
} from '../../src/api/schemas';
import { LABEL_INSTRUCTIONS_MAX, TICKET_LABELS_MAX } from '../../src/domain/label';
import { RUN_PROMPT_MAX } from '../../src/domain/run';
import { instructionsBlock } from '../../src/logic/instructions';

// PT-190 review: 50 labels of 20,000 characters each let a ticket's prompt pass the 100,000 a run
// takes, and Run in Claude Code was refused without saying why.
describe('regression: a ticket’s label instructions fit in a run prompt', () => {
  it('stay under half of the run prompt limit at the most labels and longest instructions', () => {
    const labels = Array.from({ length: TICKET_LABELS_MAX }, (_, index) => ({
      name: `Label ${index}`,
      instructions: 'x'.repeat(LABEL_INSTRUCTIONS_MAX),
    }));
    expect(instructionsBlock({}, '##', labels).join('\n').length).toBeLessThan(RUN_PROMPT_MAX / 2);
  });

  it('refuses longer label instructions, saying the limit', () => {
    const instructions = 'x'.repeat(LABEL_INSTRUCTIONS_MAX + 1);
    const message = 'Instructions can be up to 4,000 characters.';
    expect(
      createLabelInput.safeParse({ name: 'Bug', instructions }).error?.issues[0]?.message,
    ).toBe(message);
    expect(updateLabelInput.safeParse({ instructions }).error?.issues[0]?.message).toBe(message);
  });

  it('refuses more labels on a ticket, saying the limit', () => {
    const labelIds = Array.from({ length: TICKET_LABELS_MAX + 1 }, (_, index) => `l-${index}`);
    const message = 'A ticket can have up to 10 labels.';
    expect(createTicketInput.safeParse({ title: 'A', labelIds }).error?.issues[0]?.message).toBe(
      message,
    );
    expect(updateTicketInput.safeParse({ labelIds }).error?.issues[0]?.message).toBe(message);
    expect(updateTicketInput.safeParse({ labelIds: labelIds.slice(1) }).success).toBe(true);
  });
});

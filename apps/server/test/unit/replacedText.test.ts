import { describe, expect, it } from 'vitest';
import type { TicketRow } from '../../src/db/schema';
import { replacedText } from '../../src/services/replacedText';
import { agent, PERSON } from '../helpers/fixtures';

const ticket = {
  title: 'Crash on launch',
  description: 'Steps:\n1. Open',
} as TicketRow;

const NOTHING = { events: [], match: {} };

describe('replacedText', () => {
  it("keeps an agent's replaced title and description, which the write must still find", () => {
    expect(replacedText(agent(), ticket, { title: 'Crash', description: '' })).toEqual({
      events: [
        { type: 'event', text: 'changed the title from “Crash on launch”' },
        { type: 'event', text: 'removed the description\nSteps:\n1. Open' },
      ],
      match: { title: 'Crash on launch', description: 'Steps:\n1. Open' },
    });
  });

  it('keeps nothing for other fields', () => {
    expect(replacedText(agent(), ticket, { priority: 'high', assignee: '' })).toEqual(NOTHING);
  });

  it("keeps nothing for a person's own edit", () => {
    expect(replacedText(PERSON, ticket, { title: 'Crash', description: '' })).toEqual(NOTHING);
  });
});

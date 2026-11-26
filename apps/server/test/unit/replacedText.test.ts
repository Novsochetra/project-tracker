import { describe, expect, it } from 'vitest';
import type { TicketRow } from '../../src/db/schema';
import { replacedTextEvents } from '../../src/services/replacedText';
import { agent, PERSON } from '../helpers/fixtures';

const ticket = {
  title: 'Crash on launch',
  description: 'Steps:\n1. Open',
} as TicketRow;

describe('replacedTextEvents', () => {
  it("keeps an agent's replaced title and description in events", () => {
    expect(replacedTextEvents(agent(), ticket, { title: 'Crash', description: '' })).toEqual([
      { type: 'event', text: 'changed the title from “Crash on launch”' },
      { type: 'event', text: 'removed the description\nSteps:\n1. Open' },
    ]);
  });

  it('logs nothing for other fields', () => {
    expect(replacedTextEvents(agent(), ticket, { priority: 'high', assignee: '' })).toEqual([]);
  });

  it("logs nothing for a person's own edit", () => {
    expect(replacedTextEvents(PERSON, ticket, { title: 'Crash', description: '' })).toEqual([]);
  });
});

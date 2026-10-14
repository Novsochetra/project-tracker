import type { ChatMessage } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { canCreate, cardInput, messageCards } from './cards';

let next = 0;
const message = (role: ChatMessage['role'], text: string, ticketKey: string | null = null) => {
  next += 1;
  return {
    id: `m-${next}`,
    chatId: 'c-1',
    role,
    text,
    ticketKey,
    runId: null,
    batchRunId: null,
    stepCount: 0,
    createdAt: next,
  };
};
const card = (title: string) =>
  ['Here it is:', '```ticket', `Title: ${title}`, 'Priority: high', '---', 'Why.', '```'].join(
    '\n',
  );

describe('messageCards', () => {
  it('splits a Claude card into text before, the card and text after', () => {
    const answer = message('claude', `${card('Sync')}\nWant changes?`);
    expect(messageCards([answer]).get(answer.id)).toEqual({
      split: {
        before: 'Here it is:',
        card: { title: 'Sync', priority: 'high', description: 'Why.' },
        after: 'Want changes?',
      },
      replaced: false,
    });
  });

  it('marks older cards that never became tickets as replaced by the latest', () => {
    const first = message('claude', card('First'));
    const made = message('claude', card('Made'), 'MOB-7');
    const ask = message('person', 'Make step 2 smaller');
    const latest = message('claude', card('Latest'));
    const after = message('claude', 'Anything else?');
    const cards = messageCards([first, made, ask, latest, after]);
    expect(cards.get(first.id)?.replaced).toBe(true);
    expect(cards.get(made.id)?.replaced).toBe(false);
    expect(cards.get(latest.id)?.replaced).toBe(false);
    expect(cards.has(after.id)).toBe(false);
  });

  it('leaves a broken card and a card the person pasted as text', () => {
    const broken = message('claude', '```ticket\nPriority: high\n```');
    const quoted = message('person', card('Mine'));
    expect(messageCards([broken, quoted]).size).toBe(0);
  });
});

describe('card fields', () => {
  it('needs a title and sends the fields trimmed', () => {
    const fields = { title: '  Sync  ', priority: 'low' as const, description: ' Why. \n' };
    expect(canCreate(fields)).toBe(true);
    expect(canCreate({ ...fields, title: '   ' })).toBe(false);
    expect(cardInput(fields)).toEqual({ title: 'Sync', priority: 'low', description: 'Why.' });
  });
});

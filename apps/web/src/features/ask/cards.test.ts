import type { ChatMessage } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import {
  canCreate,
  cardInput,
  cardsOf,
  cardTicketKey,
  messageCards,
  offersCreateAll,
  pendingCards,
} from './cards';

let next = 0;
const message = (
  role: ChatMessage['role'],
  text: string,
  cardTickets: ChatMessage['cardTickets'] = [],
): ChatMessage => {
  next += 1;
  return {
    id: `m-${next}`,
    chatId: 'c-1',
    role,
    text,
    cardTickets,
    runId: null,
    stepCount: 0,
    usage: null,
    createdAt: next,
  };
};
const card = (title: string) =>
  ['```ticket', `Title: ${title}`, 'Priority: high', '---', 'Why.', '```'].join('\n');
const made = (index: number, ticketKey: string) => ({ index, ticketKey });

describe('messageCards', () => {
  it('splits a Claude card into text before, the card and text after', () => {
    const answer = message('claude', `Here it is:\n${card('Sync')}\nWant changes?`);
    expect(messageCards([answer]).get(answer.id)).toEqual({
      segments: [
        { kind: 'text', text: 'Here it is:' },
        { kind: 'card', index: 0, card: { title: 'Sync', priority: 'high', description: 'Why.' } },
        { kind: 'text', text: 'Want changes?' },
      ],
      latest: true,
    });
  });

  it('marks only the newest answer with cards as the latest', () => {
    const first = message('claude', card('First'));
    const ask = message('person', 'Make step 2 smaller');
    const latest = message('claude', `${card('One')}\n${card('Two')}`);
    const after = message('claude', 'Anything else?');
    const cards = messageCards([first, ask, latest, after]);
    expect(cards.get(first.id)?.latest).toBe(false);
    expect(cards.get(latest.id)?.latest).toBe(true);
    expect(cardsOf(cards.get(latest.id)?.segments ?? []).map((each) => each.title)).toEqual([
      'One',
      'Two',
    ]);
    expect(cards.has(after.id)).toBe(false);
  });

  it('leaves a broken card and a card the person pasted as text', () => {
    const broken = message('claude', '```ticket\nPriority: high\n```');
    const quoted = message('person', card('Mine'));
    expect(messageCards([broken, quoted]).size).toBe(0);
  });
});

describe('Create all', () => {
  const answer = message('claude', [card('One'), card('Two'), card('Three')].join('\n'), [
    made(1, 'MOB-8'),
  ]);
  const drafts = cardsOf(messageCards([answer]).get(answer.id)?.segments ?? []);

  it('finds each card’s ticket and leaves the made ones out, in order', () => {
    expect(cardTicketKey(answer, 1)).toBe('MOB-8');
    expect(cardTicketKey(answer, 0)).toBeNull();
    expect(pendingCards(answer, drafts).map(({ index, card }) => [index, card.title])).toEqual([
      [0, 'One'],
      [2, 'Three'],
    ]);
  });

  it('is offered on the latest answer with several cards while one is left to make', () => {
    const cards = { segments: [], latest: true };
    const pending = pendingCards(answer, drafts);
    expect(offersCreateAll({ ...cards, segments: splitOf(answer) }, pending)).toBe(true);
    expect(offersCreateAll({ ...cards, segments: splitOf(answer) }, [])).toBe(false);
    expect(offersCreateAll({ latest: false, segments: splitOf(answer) }, pending)).toBe(false);
    const single = message('claude', card('Only'));
    expect(offersCreateAll({ ...cards, segments: splitOf(single) }, pending)).toBe(false);
  });
});

function splitOf(answer: ChatMessage) {
  return messageCards([answer]).get(answer.id)?.segments ?? [];
}

describe('card fields', () => {
  it('needs a title and sends the fields trimmed with the card’s index', () => {
    const fields = { title: '  Sync  ', priority: 'low' as const, description: ' Why. \n' };
    expect(canCreate(fields)).toBe(true);
    expect(canCreate({ ...fields, title: '   ' })).toBe(false);
    expect(cardInput({ index: 2, card: fields })).toEqual({
      title: 'Sync',
      priority: 'low',
      description: 'Why.',
      index: 2,
    });
  });
});

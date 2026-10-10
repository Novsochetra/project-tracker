import { describe, expect, it } from 'vitest';
import { TICKET_TITLE_MAX } from '../src/domain/ticket';
import { splitTicketCard } from '../src/logic/ticketCard';

const lines = (...parts: string[]) => parts.join('\n');
const FOUR = '````';
const THREE = '```';

const card = (body: string[], fence = FOUR) => lines(`${fence}ticket`, ...body, fence);

describe('splitTicketCard', () => {
  it('reads the title, priority and description and keeps the text around the card', () => {
    const text = lines(
      'Here is a draft.',
      '',
      card(['title: Add a chat screen', 'priority: high', '---', '## Why', 'Phones need it.']),
      '',
      'Tap Create when it looks right.',
    );
    expect(splitTicketCard(text)).toEqual({
      before: 'Here is a draft.',
      card: {
        title: 'Add a chat screen',
        priority: 'high',
        description: '## Why\nPhones need it.',
      },
      after: 'Tap Create when it looks right.',
    });
  });

  it('keeps a code block inside the description when the card uses four backticks', () => {
    const text = card(['title: T', '---', 'Run:', THREE, 'npm test', THREE, 'Then check.']);
    expect(splitTicketCard(text)?.card.description).toBe(
      lines('Run:', THREE, 'npm test', THREE, 'Then check.'),
    );
  });

  it('reads a card in three backticks too', () => {
    expect(splitTicketCard(card(['title: T', '---', 'D'], THREE))?.card).toEqual({
      title: 'T',
      priority: 'medium',
      description: 'D',
    });
  });

  it('takes the last card, since a changed card comes after the first', () => {
    const text = lines(card(['title: Old']), 'Changed:', card(['title: New']));
    const split = splitTicketCard(text);
    expect(split?.card.title).toBe('New');
    expect(split?.before).toContain('title: Old');
  });

  it.each([
    ['no card', 'Just an answer.'],
    ['a card with no title', card(['priority: high', '---', 'D'])],
    ['a card that never closes', lines(`${FOUR}ticket`, 'title: T', '---', 'D')],
    ['another kind of code block', lines(`${THREE}ts`, 'title: T', THREE)],
  ])('gives null for %s, so it shows as plain text', (_name, text) => {
    expect(splitTicketCard(text)).toBeNull();
  });

  it('reads fields in any case and with spaces, and an unknown priority as medium', () => {
    const split = splitTicketCard(card(['  Title :  Spaced  ', 'PRIORITY: urgent']));
    expect(split?.card).toEqual({ title: 'Spaced', priority: 'medium', description: '' });
  });

  it('cuts a title that is too long', () => {
    const split = splitTicketCard(card([`title: ${'x'.repeat(TICKET_TITLE_MAX + 10)}`]));
    expect(split?.card.title).toHaveLength(TICKET_TITLE_MAX);
  });

  it('reads Windows line ends', () => {
    expect(splitTicketCard(card(['title: T', '---', 'D']).replace(/\n/g, '\r\n'))?.card.title).toBe(
      'T',
    );
  });
});

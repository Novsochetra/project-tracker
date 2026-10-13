import { describe, expect, it } from 'vitest';
import { TICKET_TITLE_MAX } from '../src/domain/ticket';
import { splitTicketCards, ticketCards, type CardSegment } from '../src/logic/ticketCard';

const lines = (...parts: string[]) => parts.join('\n');
const FOUR = '````';
const THREE = '```';

const card = (body: string[], fence = FOUR) => lines(`${fence}ticket`, ...body, fence);
const firstCard = (text: string) =>
  splitTicketCards(text).find((segment) => segment.kind === 'card');
const texts = (segments: CardSegment[]) =>
  segments.map((segment) => (segment.kind === 'text' ? segment.text : `#${segment.index}`));

describe('splitTicketCards', () => {
  it('reads the title, priority and description and keeps the text around the card', () => {
    const text = lines(
      'Here is a draft.',
      '',
      card(['title: Add a chat screen', 'priority: high', '---', '## Why', 'Phones need it.']),
      '',
      'Tap Create when it looks right.',
    );
    expect(splitTicketCards(text)).toEqual([
      { kind: 'text', text: 'Here is a draft.' },
      {
        kind: 'card',
        index: 0,
        card: {
          title: 'Add a chat screen',
          priority: 'high',
          description: '## Why\nPhones need it.',
        },
      },
      { kind: 'text', text: 'Tap Create when it looks right.' },
    ]);
  });

  it('gives an answer with no card as its text alone', () => {
    expect(splitTicketCards('  Just an answer.\n')).toEqual([
      { kind: 'text', text: 'Just an answer.' },
    ]);
    expect(splitTicketCards('')).toEqual([]);
  });

  it('reads every card in order, with the text between them', () => {
    const text = lines(
      'Three tickets:',
      card(['title: One', 'priority: high']),
      'Then:',
      card(['title: Two']),
      card(['title: Three', 'priority: low', '---', 'Last.']),
      'Tap Create all.',
    );
    const segments = splitTicketCards(text);
    expect(texts(segments)).toEqual([
      'Three tickets:',
      '#0',
      'Then:',
      '#1',
      '#2',
      'Tap Create all.',
    ]);
    expect(ticketCards(text).map((each) => [each.title, each.priority])).toEqual([
      ['One', 'high'],
      ['Two', 'medium'],
      ['Three', 'low'],
    ]);
  });

  it('keeps a broken card between good ones as text, and counts only the good ones', () => {
    const text = lines(
      card(['title: One']),
      card(['priority: high', '---', 'No title.']),
      card(['title: Two']),
    );
    const segments = splitTicketCards(text);
    expect(texts(segments)).toEqual([
      '#0',
      lines(`${FOUR}ticket`, 'priority: high', '---', 'No title.', FOUR),
      '#1',
    ]);
    expect(ticketCards(text).map((each) => each.title)).toEqual(['One', 'Two']);
  });

  it('keeps the cards before one that never closes, and the rest as text', () => {
    const text = lines(card(['title: One']), `${FOUR}ticket`, 'title: Two', '---', 'D');
    expect(texts(splitTicketCards(text))).toEqual([
      '#0',
      lines(`${FOUR}ticket`, 'title: Two', '---', 'D'),
    ]);
  });

  it('keeps a code block inside the description when the card uses four backticks', () => {
    const text = card(['title: T', '---', 'Run:', THREE, 'npm test', THREE, 'Then check.']);
    expect(ticketCards(text)[0]?.description).toBe(
      lines('Run:', THREE, 'npm test', THREE, 'Then check.'),
    );
  });

  it('reads a card in three backticks too', () => {
    expect(ticketCards(card(['title: T', '---', 'D'], THREE))).toEqual([
      { title: 'T', priority: 'medium', description: 'D' },
    ]);
  });

  it.each([
    ['no card', 'Just an answer.'],
    ['a card with no title', card(['priority: high', '---', 'D'])],
    ['a card that never closes', lines(`${FOUR}ticket`, 'title: T', '---', 'D')],
    ['another kind of code block', lines(`${THREE}ts`, 'title: T', THREE)],
  ])('finds no card in %s, so it shows as plain text', (_name, text) => {
    expect(ticketCards(text)).toEqual([]);
    expect(splitTicketCards(text)).toEqual([{ kind: 'text', text }]);
  });

  it('reads fields in any case and with spaces, and an unknown priority as medium', () => {
    const found = firstCard(card(['  Title :  Spaced  ', 'PRIORITY: urgent']));
    expect(found).toMatchObject({ card: { title: 'Spaced', priority: 'medium', description: '' } });
  });

  it('cuts a title that is too long', () => {
    const [found] = ticketCards(card([`title: ${'x'.repeat(TICKET_TITLE_MAX + 10)}`]));
    expect(found?.title).toHaveLength(TICKET_TITLE_MAX);
  });

  it('reads Windows line ends', () => {
    expect(ticketCards(card(['title: T', '---', 'D']).replace(/\n/g, '\r\n'))[0]?.title).toBe('T');
  });
});

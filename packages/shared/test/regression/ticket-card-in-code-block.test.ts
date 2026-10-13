import { describe, expect, it } from 'vitest';
import { splitTicketCards, ticketCards } from '../../src/logic/ticketCard';

const lines = (...parts: string[]) => parts.join('\n');
const example = (fence: string) =>
  lines(`${fence}md`, '````ticket', 'title: Only an example', '---', 'D', '````', fence);

// A card shown as an example inside another code block is code, as Markdown renders it, not a
// ticket that cuts the block in two (PT-186 review).
describe('regression: a ticket card inside another code block', () => {
  it.each([
    ['five backticks', '`````'],
    ['tildes', '~~~'],
  ])('stays code in a block fenced with %s', (_name, fence) => {
    const text = lines('A card looks like this:', example(fence), 'That is all.');
    expect(ticketCards(text)).toEqual([]);
    expect(splitTicketCards(text)).toEqual([{ kind: 'text', text }]);
  });

  it('stays code in a block of three backticks, which the card fence ends as in Markdown', () => {
    expect(ticketCards(example('```'))).toEqual([]);
  });

  it('still reads a real card after the example', () => {
    const text = lines(example('`````'), '````ticket', 'title: Real', '````');
    expect(ticketCards(text).map((card) => card.title)).toEqual(['Real']);
  });

  it('reads nothing after a code block that never closes', () => {
    const text = lines('```md', 'notes', '````ticket', 'title: Inside', '````');
    expect(ticketCards(text)).toEqual([]);
  });
});

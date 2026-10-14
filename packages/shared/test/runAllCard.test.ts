import { describe, expect, it } from 'vitest';
import { buildAskPrompt, splitRunAllCard } from '../src';

const card = (...body: string[]) => ['````run-all', ...body, '````'].join('\n');

describe('splitRunAllCard', () => {
  it('reads the limit the person asked for', () => {
    expect(splitRunAllCard(`Sure, 3 at a time.\n\n${card('limit: 3')}`)).toEqual({
      before: 'Sure, 3 at a time.',
      limit: 3,
      after: '',
    });
  });

  it('leaves the limit to the project when the card has none', () => {
    expect(splitRunAllCard(card())?.limit).toBeNull();
    expect(splitRunAllCard(card('limit: <how many at once, 1 to 5>'))?.limit).toBeNull();
  });

  it.each([
    ['10', 5],
    ['0', 1],
    ['2 at a time', 2],
  ])('reads limit %s as %d', (value, limit) => {
    expect(splitRunAllCard(card(`limit: ${value}`))?.limit).toBe(limit);
  });

  it('reads the limit whatever its case and spacing', () => {
    expect(splitRunAllCard(card('  LIMIT :4'))?.limit).toBe(4);
  });

  it('keeps the words after the card', () => {
    expect(splitRunAllCard(`${card('limit: 2')}\nTap Confirm.`)?.after).toBe('Tap Confirm.');
  });

  it('takes the last card when there are two', () => {
    expect(splitRunAllCard(`${card('limit: 2')}\n\n${card('limit: 4')}`)?.limit).toBe(4);
  });

  it('finds no card in plain text, a ticket card or an unclosed fence', () => {
    expect(splitRunAllCard('Do all Todo, 3 at a time')).toBeNull();
    expect(splitRunAllCard('````ticket\ntitle: X\n````')).toBeNull();
    expect(splitRunAllCard('````run-all\nlimit: 3')).toBeNull();
  });

  it('reads the card the chat prompt shows Claude', () => {
    const prompt = buildAskPrompt({
      project: { key: 'PT', name: 'Tracker' },
      mode: 'ask',
      question: 'Do all Todo, 3 at a time',
      history: [],
    });
    const example = /````run-all\n[\s\S]*?\n````/.exec(prompt)?.[0] ?? '';
    expect(splitRunAllCard(example)).toEqual({ before: '', limit: null, after: '' });
  });
});

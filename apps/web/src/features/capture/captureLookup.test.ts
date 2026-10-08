import { listTicketsQuery, matchesSearch, type Ticket } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { matchesCapture, searchTextFor } from './captureLookup';
import type { QueuedCapture } from './captureQueue';

const accepted = (q: string) => listTicketsQuery.safeParse({ q }).success;

// What the server's search finds for this text, given the full title.
const finds = (title: string, q: string) => matchesSearch({ title, key: 'MOB-1' }, q);

describe('searchTextFor', () => {
  it('searches for a title the search accepts as it is', () => {
    expect(searchTextFor('Fix login on iOS')).toBe('Fix login on iOS');
    const longest = 'y'.repeat(200);
    expect(searchTextFor(longest)).toBe(longest);
  });

  it('searches for the whole words a long title starts with, within the limit', () => {
    const title = `${'word '.repeat(70)}end`;
    const q = searchTextFor(title);
    expect(accepted(q)).toBe(true);
    expect(title.startsWith(q)).toBe(true);
    expect(q.trimEnd().endsWith('word')).toBe(true);
    expect(finds(title, q)).toBe(true);
  });

  it('keeps words whole, since a cut word can lower-case differently', () => {
    // Σ inside a word lower-cases to σ, but at the end of a word cut at 200 it would turn ς.
    const title = `${'Α'.repeat(195)} ΟΔΟΣΑΒΓΔ`;
    expect(finds(title, title.slice(0, 200))).toBe(false);
    const q = searchTextFor(title);
    expect(accepted(q)).toBe(true);
    expect(finds(title, q)).toBe(true);
  });

  it('cuts one long word at the limit, never inside an emoji', () => {
    const link = `https://example.com/${'p'.repeat(179)}😀${'q'.repeat(100)}`;
    const q = searchTextFor(link);
    expect(accepted(q)).toBe(true);
    expect(link.startsWith(q)).toBe(true);
    expect(q.endsWith('p')).toBe(true);
    expect(() => encodeURIComponent(q)).not.toThrow();
  });
});

describe('matchesCapture', () => {
  const capture: QueuedCapture = {
    id: 'a',
    projectKey: 'MOB',
    title: 'Fix login',
    description: 'On iOS',
    priority: 'medium',
    capturedAt: 1_000_000,
    attempted: true,
  };
  const ticket = (overrides: Partial<Ticket> = {}): Ticket => ({
    id: 't-1',
    projectId: 'p-mob',
    num: 1,
    key: 'MOB-1',
    statusId: 's-todo',
    rank: 0,
    title: 'Fix login',
    description: 'On iOS',
    priority: 'medium',
    assignee: '',
    due: '',
    createdAt: 1_000_500,
    updatedAt: 1_000_500,
    ...overrides,
  });

  it('matches the ticket with the same text made after the capture', () => {
    expect(matchesCapture(ticket(), capture)).toBe(true);
  });

  it('allows for a server clock a little behind the phone', () => {
    expect(matchesCapture(ticket({ createdAt: 1_000_000 - 60_000 }), capture)).toBe(true);
  });

  it('does not match other text or an older ticket', () => {
    expect(matchesCapture(ticket({ title: 'Fix login now' }), capture)).toBe(false);
    expect(matchesCapture(ticket({ description: '' }), capture)).toBe(false);
    expect(matchesCapture(ticket({ createdAt: 1_000_000 - 10 * 60_000 }), capture)).toBe(false);
  });
});

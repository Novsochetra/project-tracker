import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

// An agent's "Opened a PR: https://… - preview build at https://…" showed as plain text, so on a
// phone checking its work meant long-press, select, copy, switch to Safari and paste.

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

it('makes the URLs in a comment tappable, without the punctuation around them', () => {
  const text = [
    'Opened a PR: https://github.com/example/mobile-app/pull/42 - preview build at',
    'https://preview.example.com/build/123',
    'see https://x.dev/a. (https://x.dev/b)',
  ].join('\n');
  const activity = [comment('c1', text, { actor: { kind: 'agent', name: 'Claude' } })];
  const detail = makeTicketDetail(undefined, { activity });
  cleanups.push(renderTicket({ detail, phone: true }).restorePhone);
  const links = within(screen.getByRole('region', { name: 'Activity' })).getAllByRole('link');
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    'https://github.com/example/mobile-app/pull/42',
    'https://preview.example.com/build/123',
    'https://x.dev/a',
    'https://x.dev/b',
  ]);
  expect(links.every((link) => link.getAttribute('target') === '_blank')).toBe(true);
});

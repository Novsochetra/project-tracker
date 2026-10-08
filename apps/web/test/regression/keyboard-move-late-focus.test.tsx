import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import type { Ticket } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred } from '../../src/api/test/deferred';
import { resetListView } from '../../src/features/project/listViewStore';
import { renderProject } from '../../src/features/project/test/renderProject';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

vi.mock('../../src/features/projects/ProjectOptionsButton', () => ({
  ProjectOptionsButton: () => null,
}));

// A keyboard move took focus back to its handle for 1s after the key press. A move that
// rendered later (a slow phone, a loaded test run) or that the tracker refused later (a slow
// network) re-rendered the row after that second, and focus fell back to the page.

const HANDLE = 'Move MOB-2. Drag, or use the arrow keys.';
const handle = () => screen.getByRole('button', { name: HANDLE });
const keysIn = (group: string) =>
  within(screen.getByRole('region', { name: group }))
    .getAllByRole('button', { name: /^MOB-\d+/ })
    .map((button) => /^MOB-\d+/.exec(button.textContent ?? '')?.[0]);

function passTime(ms: number) {
  const now = performance.now.bind(performance);
  vi.spyOn(performance, 'now').mockImplementation(() => now() + ms);
}

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  vi.restoreAllMocks();
  restore.forEach((undo) => undo());
  resetListView('MOB');
});

describe('regression: a keyboard move keeps its handle focused until the move is over', () => {
  it('takes focus back when the move renders more than a second after the key press', async () => {
    renderProject({ client: { moveTicket: vi.fn(() => new Promise<Ticket>(() => undefined)) } });
    (await screen.findByRole('button', { name: HANDLE })).focus();
    fireEvent.keyDown(handle(), { key: 'ArrowDown' });
    passTime(1_001);
    await waitFor(() => expect(keysIn('In progress')).toEqual(['MOB-2', 'MOB-3']));
    expect(handle()).toHaveFocus();
  });

  it('takes focus back when the tracker refuses the move more than a second later', async () => {
    const answer = deferred<Ticket>();
    renderProject({ client: { moveTicket: vi.fn(() => answer.promise) } });
    (await screen.findByRole('button', { name: HANDLE })).focus();
    fireEvent.keyDown(handle(), { key: 'ArrowDown' });
    await waitFor(() => expect(keysIn('In progress')).toEqual(['MOB-2', 'MOB-3']));
    expect(handle()).toHaveFocus();

    passTime(1_001);
    answer.reject(new ApiError(409, 'conflict', 'MOB-2 changed elsewhere.'));
    await waitFor(() => expect(keysIn('To do')).toEqual(['MOB-1', 'MOB-2']));
    expect(handle()).toHaveFocus();
  });
});

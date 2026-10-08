import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announce } from '../../src/app/announce';
import { renderProject } from '../../src/features/project/test/renderProject';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

vi.mock('../../src/features/projects/ProjectOptionsButton', () => ({
  ProjectOptionsButton: () => null,
}));

const HANDLE = 'Move MOB-1. Drag, or use the arrow keys.';

const todoKeys = () =>
  within(screen.getByRole('region', { name: 'To do' }))
    .getAllByRole('button', { name: /^MOB-\d+/ })
    .map((button) => /^MOB-\d+/.exec(button.textContent ?? '')?.[0]);

function recordAnnouncements(): () => string[] {
  const region = document.querySelector('[aria-live="polite"]');
  if (!region) throw new Error('The project screen renders no live region');
  const records: MutationRecord[] = [];
  const observer = new MutationObserver((batch) => records.push(...batch));
  observer.observe(region, { childList: true, subtree: true, characterData: true });
  return () => {
    records.push(...observer.takeRecords());
    observer.disconnect();
    return records
      .flatMap((record) => [...record.addedNodes].map((node) => node.textContent ?? ''))
      .filter((text) => text !== '');
  };
}

let restore: (() => void)[] = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  announce('');
});

describe('regression: every keyboard reorder of the same ticket is announced', () => {
  it('announces "MOB-1 moved" for each of two moves', async () => {
    const user = userEvent.setup();
    renderProject({ client: { moveTicket: vi.fn(() => new Promise(() => undefined)) } });
    const handle = await screen.findByRole('button', { name: HANDLE });
    const heard = recordAnnouncements();

    handle.focus();
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(todoKeys()).toEqual(['MOB-2', 'MOB-1']));
    await user.keyboard('{ArrowUp}');
    await waitFor(() => expect(todoKeys()).toEqual(['MOB-1', 'MOB-2']));

    expect(heard()).toEqual(['MOB-1 moved', 'MOB-1 moved']);
  });
});

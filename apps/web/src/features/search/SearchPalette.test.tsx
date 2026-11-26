import type { TicketSearchResults } from '@tracker/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { otherProject, project, summaryOf } from '../../api/test/fixtures';
import { SheetsProvider } from '../../app/sheets/SheetsProvider';
import { currentPath, renderWithApp } from '../../app/test/harness';
import { mockPhone, skipAnimations } from '../../overlays/testing';
import { SearchButton } from './SearchButton';
import { SearchShortcut } from './SearchShortcut';
import { searchHit } from './test/hits';

const RECENT: TicketSearchResults = {
  tickets: [searchHit('MOB-4', { title: 'Recent work', match: 'recent' })],
};
const ROTATE: TicketSearchResults = {
  tickets: [
    searchHit('WEB-1', { title: 'Crash on rotate', match: 'title' }),
    searchHit('MOB-2', {
      title: 'Cache avatars',
      match: 'description',
      snippet: '…turn the phone to rotate it…',
    }),
  ],
};

function renderPalette(path = '/') {
  const searchTickets = vi.fn(({ q }: { q?: string }) => Promise.resolve(q ? ROTATE : RECENT));
  const app = renderWithApp(
    <SheetsProvider>
      <SearchShortcut />
      <SearchButton />
      <input aria-label="Ticket title" />
    </SheetsProvider>,
    {
      path,
      projects: [summaryOf(project), summaryOf(otherProject)],
      client: { searchTickets },
    },
  );
  return { ...app, searchTickets, user: userEvent.setup() };
}

const palette = () => screen.queryByRole('dialog', { name: 'Search' });
const field = () => screen.getByRole('combobox', { name: 'Search projects and tickets' });
const selected = () =>
  within(screen.getByRole('listbox', { name: 'Results' }))
    .getAllByRole('option')
    .find((option) => option.getAttribute('aria-selected') === 'true');

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
});

afterEach(() => {
  restore.forEach((undo) => undo());
  vi.restoreAllMocks();
});

describe('search palette', () => {
  it('opens with Command-K, even from a text field, showing projects and recent tickets', async () => {
    const { user, searchTickets } = renderPalette();
    await user.click(screen.getByRole('textbox', { name: 'Ticket title' }));
    await user.keyboard('{Meta>}k{/Meta}');

    expect(await screen.findByRole('dialog', { name: 'Search' })).toBeInTheDocument();
    await waitFor(() => expect(field()).toHaveFocus());
    const projects = await screen.findByRole('group', { name: 'Projects' });
    expect(
      within(projects)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Mobile appMOB', 'WebsiteWEB']);
    const recent = await screen.findByRole('group', { name: 'Recent tickets' });
    expect(within(recent).getByRole('option')).toHaveTextContent('MOB-4Recent work');
    expect(searchTickets).toHaveBeenCalledWith(expect.objectContaining({ q: '' }));
  });

  it('searches as you type, moves with the arrows and opens the ticket with Enter', async () => {
    const { user, searchTickets } = renderPalette();
    await user.keyboard('{Meta>}k{/Meta}');
    await waitFor(() => expect(field()).toHaveFocus());
    await user.type(field(), 'rotate');

    const ticketOptions = () =>
      within(screen.getByRole('group', { name: 'Tickets' })).getAllByRole('option');
    await waitFor(() => expect(ticketOptions()).toHaveLength(2));
    const tickets = screen.getByRole('group', { name: 'Tickets' });
    expect(searchTickets).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'rotate' }));
    const [, described] = within(tickets).getAllByRole('option');
    expect(described).toHaveTextContent('…turn the phone to rotate it…');
    expect(described?.querySelector('mark')).toHaveTextContent('rotate');
    expect(selected()).toHaveTextContent('WEB-1');

    await user.keyboard('{ArrowDown}');
    expect(selected()).toHaveTextContent('MOB-2');
    expect(field()).toHaveAttribute('aria-activedescendant', selected()?.id);
    await user.keyboard('{Enter}');

    await waitFor(() => expect(currentPath()).toBe('/p/MOB/2'));
    await waitFor(() => expect(palette()).not.toBeInTheDocument());
  });

  it('opens a project with a click', async () => {
    const { user } = renderPalette();
    await user.click(screen.getByRole('button', { name: /Search/ }));
    await user.click(await screen.findByRole('option', { name: /Website/ }));
    await waitFor(() => expect(currentPath()).toBe('/p/WEB'));
  });

  it('opens a ticket key typed in full before its results arrive', async () => {
    const { user } = renderPalette();
    await user.keyboard('{Meta>}k{/Meta}');
    await waitFor(() => expect(field()).toHaveFocus());
    await user.type(field(), 'web 7{Enter}');
    await waitFor(() => expect(currentPath()).toBe('/p/WEB/7'));
  });

  it('closes with Escape or Command-K again, and gives focus back', async () => {
    const { user } = renderPalette();
    const title = screen.getByRole('textbox', { name: 'Ticket title' });
    await user.click(title);
    await user.keyboard('{Meta>}k{/Meta}');
    await waitFor(() => expect(field()).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(palette()).not.toBeInTheDocument());
    expect(title).toHaveFocus();

    await user.keyboard('{Meta>}k{/Meta}');
    await waitFor(() => expect(field()).toHaveFocus());
    await user.keyboard('{Meta>}k{/Meta}');
    await waitFor(() => expect(palette()).not.toBeInTheDocument());
  });

  it('keeps Tab inside the sheet', async () => {
    const { user } = renderPalette();
    await user.keyboard('{Meta>}k{/Meta}');
    await waitFor(() => expect(field()).toHaveFocus());
    await user.keyboard('{Tab}');
    expect(within(palette()!).getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('ignores Control-K on a Mac', async () => {
    const { user } = renderPalette();
    await user.keyboard('{Control>}k{/Control}');
    expect(palette()).not.toBeInTheDocument();
  });
});

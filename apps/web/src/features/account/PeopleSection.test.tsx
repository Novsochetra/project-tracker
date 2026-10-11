import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InvitedUser } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { renderWithApi } from '../claude/test/renderWithApi';
import { PeopleSection } from './PeopleSection';

const MADE = new Date(2026, 9, 11, 12).getTime();
const UNTIL = new Date(2026, 9, 12, 12).getTime();
const SAM: InvitedUser = {
  id: 'u-1',
  name: 'Sam',
  email: 'sam@example.com',
  createdAt: MADE,
  resetExpiresAt: null,
};

describe('PeopleSection', () => {
  it('makes a reset link for one person, shown once', async () => {
    const user = userEvent.setup();
    const makeResetLink = vi.fn().mockResolvedValue({ expiresAt: UNTIL, secret: 's3cr3t' });
    const listInvitedUsers = vi
      .fn()
      .mockResolvedValueOnce([SAM])
      .mockResolvedValue([{ ...SAM, resetExpiresAt: UNTIL }]);
    renderWithApi(<PeopleSection />, { listInvitedUsers, makeResetLink });
    await user.click(await screen.findByRole('button', { name: 'Make a reset link for Sam' }));
    expect(makeResetLink).toHaveBeenCalledWith('u-1');
    const card = await screen.findByRole('group', { name: 'New reset link' });
    expect(card).toHaveTextContent('The reset link for Sam is ready');
    expect(card).toHaveTextContent(`${window.location.origin}/reset-password#s3cr3t`);
    const people = screen.getByRole('list', { name: 'People' });
    expect(await within(people).findByText(/Reset link works until Oct 12, 2026/)).toBeVisible();
    await user.click(within(card).getByRole('button', { name: 'Done' }));
    expect(screen.queryByText(/s3cr3t/)).not.toBeInTheDocument();
  });

  it('cancels an open reset link', async () => {
    const user = userEvent.setup();
    const cancelResetLink = vi.fn().mockResolvedValue(undefined);
    renderWithApi(<PeopleSection />, {
      listInvitedUsers: vi.fn().mockResolvedValue([{ ...SAM, resetExpiresAt: UNTIL }]),
      cancelResetLink,
    });
    await user.click(await screen.findByRole('button', { name: 'Cancel the reset link for Sam' }));
    await waitFor(() => expect(cancelResetLink).toHaveBeenCalledWith('u-1'));
    expect(await screen.findByText('Reset link cancelled')).toBeInTheDocument();
  });

  it('shows nothing while nobody has been invited', async () => {
    const listInvitedUsers = vi.fn().mockResolvedValue([]);
    renderWithApi(<PeopleSection />, { listInvitedUsers });
    await waitFor(() => expect(listInvitedUsers).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByRole('heading', { name: 'People' })).not.toBeInTheDocument();
  });
});

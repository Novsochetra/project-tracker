import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../api';
import { setupApi } from '../api/test/render';
import { InviteScreen } from './InviteScreen';
import { LocationProbe } from './test/LocationProbe';

const SIGNED_OUT = { authRequired: true, authenticated: false };
const NEWCOMER = { authRequired: true, authenticated: true, email: 'sam@example.com' };
const UNTIL = new Date(2026, 9, 18, 12).getTime();

function renderInvite(overrides: Parameters<typeof setupApi>[0], session = SIGNED_OUT) {
  const api = setupApi({ getSession: vi.fn().mockResolvedValue(NEWCOMER), ...overrides });
  act(() => {
    api.queryClient.setQueryData(queryKeys.session(), session);
  });
  render(
    <MemoryRouter initialEntries={['/invite#s3cr3t']}>
      <InviteScreen />
      <LocationProbe />
    </MemoryRouter>,
    { wrapper: api.wrapper },
  );
  return api;
}

describe('InviteScreen', () => {
  it('makes the account with the secret from the link, then opens the app', async () => {
    const user = userEvent.setup();
    const acceptInvite = vi.fn().mockResolvedValue(NEWCOMER);
    const api = renderInvite({
      checkInvite: vi.fn().mockResolvedValue({ expiresAt: UNTIL }),
      acceptInvite,
    });
    expect(await screen.findByText(/works once, until Oct 18, 2026/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'Sam');
    await user.type(screen.getByLabelText('Email'), ' sam@example.com ');
    await user.type(screen.getByLabelText(/^Password/), 'a long new password');
    await user.click(screen.getByRole('button', { name: 'Make account' }));
    await waitFor(() =>
      expect(acceptInvite).toHaveBeenCalledWith({
        secret: 's3cr3t',
        name: 'Sam',
        email: 'sam@example.com',
        password: 'a long new password',
      }),
    );
    await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/$/));
    expect(api.queryClient.getQueryData(queryKeys.session())).toEqual(NEWCOMER);
  });

  it('says why a link no longer works', async () => {
    const expired = new ApiError(404, 'not_found', 'This invite has expired. Ask for a new one.');
    renderInvite({ checkInvite: vi.fn().mockRejectedValue(expired) });
    expect(await screen.findByRole('alert')).toHaveTextContent('This invite has expired.');
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('shows what the server refused, and keeps what was typed', async () => {
    const user = userEvent.setup();
    const taken = new ApiError(409, 'conflict', 'An account with this email already exists.');
    renderInvite({
      checkInvite: vi.fn().mockResolvedValue({ expiresAt: UNTIL }),
      acceptInvite: vi.fn().mockRejectedValue(taken),
    });
    await user.type(await screen.findByLabelText('Name'), 'Sam');
    await user.click(screen.getByRole('button', { name: 'Make account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
    expect(screen.getByLabelText('Name')).toHaveValue('Sam');
  });

  it('asks a signed-in person to sign out first', async () => {
    const user = userEvent.setup();
    const logout = vi.fn().mockResolvedValue(SIGNED_OUT);
    renderInvite({ checkInvite: vi.fn().mockResolvedValue({ expiresAt: UNTIL }), logout }, {
      authRequired: true,
      authenticated: true,
      email: 'owner@example.com',
    } as typeof SIGNED_OUT);
    expect(screen.getByText(/signed in as owner@example.com/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByLabelText('Name')).toBeInTheDocument();
  });
});

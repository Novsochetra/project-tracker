import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../api';
import { setupApi } from '../api/test/render';
import { ResetScreen } from './ResetScreen';
import { LocationProbe } from './test/LocationProbe';

const SIGNED_OUT = { authRequired: true, authenticated: false };
const UNTIL = new Date(2026, 9, 12, 12).getTime();
const CHECKED = { email: 'sam@example.com', expiresAt: UNTIL };

function renderReset(overrides: Parameters<typeof setupApi>[0], entry = '/reset-password#s3cr3t') {
  const api = setupApi({ getSession: vi.fn().mockResolvedValue(SIGNED_OUT), ...overrides });
  act(() => {
    api.queryClient.setQueryData(queryKeys.session(), SIGNED_OUT);
  });
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ResetScreen />
      <LocationProbe />
    </MemoryRouter>,
    { wrapper: api.wrapper },
  );
  return api;
}

describe('ResetScreen', () => {
  it('sets the new password with the secret from the link, then sends the person to sign in', async () => {
    const user = userEvent.setup();
    const resetPassword = vi.fn().mockResolvedValue(undefined);
    renderReset({ checkResetLink: vi.fn().mockResolvedValue(CHECKED), resetPassword });
    expect(await screen.findByText(/For sam@example.com\. This link works once/)).toBeVisible();
    await user.type(screen.getByLabelText(/^New password/), 'a brand new password');
    await user.click(screen.getByRole('button', { name: 'Set password' }));
    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith({
        secret: 's3cr3t',
        password: 'a brand new password',
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Password set' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Go to sign in' }));
    expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/$/);
  });

  it('keeps the form with the reason when the password is refused', async () => {
    const user = userEvent.setup();
    const short = new ApiError(
      400,
      'invalid_input',
      'Use at least 12 characters for the password.',
    );
    renderReset({
      checkResetLink: vi.fn().mockResolvedValue(CHECKED),
      resetPassword: vi.fn().mockRejectedValue(short),
    });
    await user.type(await screen.findByLabelText(/^New password/), 'short');
    await user.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Use at least 12 characters');
    expect(screen.getByLabelText(/^New password/)).toHaveAttribute('aria-describedby');
  });

  it('says why a link no longer works', async () => {
    const used = new ApiError(404, 'not_found', 'This reset link was already used.');
    renderReset({ checkResetLink: vi.fn().mockRejectedValue(used) });
    expect(await screen.findByRole('alert')).toHaveTextContent('This reset link was already used.');
    expect(screen.queryByLabelText(/^New password/)).not.toBeInTheDocument();
  });

  it('asks nothing of the server for a link without a secret', async () => {
    const checkResetLink = vi.fn();
    renderReset({ checkResetLink }, '/reset-password');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This reset link does not work. Ask the owner for a new one.',
    );
    expect(checkResetLink).not.toHaveBeenCalled();
  });
});

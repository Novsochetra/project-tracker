import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../api';
import { renderWithApi, sheetTestSetup } from '../claude/test/renderWithApi';
import { AccountSheet } from './AccountSheet';

const OWNER = { authRequired: true, authenticated: true, email: 'me@example.com' };
const SIGNED_OUT = { authRequired: true, authenticated: false };

const sheet = () => screen.getByRole('dialog', { name: 'Account' });

// The app's session gate has loaded the session by the time the sheet can open.
function renderSheet(onClose: () => void, overrides: Parameters<typeof renderWithApi>[1]) {
  const view = renderWithApi(<AccountSheet open onClose={onClose} />, overrides);
  act(() => {
    view.queryClient.setQueryData(queryKeys.session(), OWNER);
  });
  return view;
}

let restore: () => void;

beforeEach(() => {
  restore = sheetTestSetup(true);
});

afterEach(() => {
  restore();
});

describe('AccountSheet', () => {
  it('says who is signed in and closes after signing out', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const logout = vi.fn().mockResolvedValue(SIGNED_OUT);
    renderSheet(onClose, { logout });
    expect(await within(sheet()).findByText('me@example.com')).toBeInTheDocument();
    await user.click(within(sheet()).getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('stays open with the reason when signing out fails', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderSheet(onClose, { logout: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) });
    await user.click(await within(sheet()).findByRole('button', { name: 'Sign out' }));
    expect(await within(sheet()).findByRole('alert')).toHaveTextContent("Can't reach the tracker.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it('asks before signing out everywhere, and can be talked out of it', async () => {
    const user = userEvent.setup();
    const signOutEverywhere = vi.fn().mockResolvedValue(SIGNED_OUT);
    renderSheet(() => undefined, { signOutEverywhere });
    await user.click(await within(sheet()).findByRole('button', { name: 'Sign out everywhere' }));
    const confirm = within(sheet()).getByRole('alert');
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(within(sheet()).queryByRole('alert')).not.toBeInTheDocument();
    expect(signOutEverywhere).not.toHaveBeenCalled();
    expect(within(sheet()).getByText(/keep working with their API tokens/)).toBeInTheDocument();
  });
});

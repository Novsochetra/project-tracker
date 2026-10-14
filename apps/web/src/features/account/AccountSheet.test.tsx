import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../api';
import { renderWithApi, sheetTestSetup } from '../claude/test/renderWithApi';
import { stubPush, unstubPush } from '../push/test/fakePush';
import { AccountSheet } from './AccountSheet';

const OWNER = { authRequired: true, authenticated: true, email: 'me@example.com', role: 'owner' };
const USER = { ...OWNER, email: 'sam@example.com', role: 'user' };
const MADE = new Date(2026, 9, 11, 12).getTime();
const INVITE = { id: 'i-1', createdAt: MADE, expiresAt: MADE + 7 * 24 * 60 * 60 * 1000 };
const SIGNED_OUT = { authRequired: true, authenticated: false };

const sheet = () => screen.getByRole('dialog', { name: 'Account' });

// The app's session gate has loaded the session by the time the sheet can open.
function renderSheet(
  onClose: () => void,
  overrides: Parameters<typeof renderWithApi>[1],
  session: object = OWNER,
) {
  const view = renderWithApi(<AccountSheet open onClose={onClose} />, {
    listInvites: vi.fn().mockResolvedValue([]),
    listInvitedUsers: vi.fn().mockResolvedValue([]),
    listPlanUsage: vi.fn().mockResolvedValue([]),
    ...overrides,
  });
  act(() => {
    view.queryClient.setQueryData(queryKeys.session(), session);
  });
  return view;
}

let restore: () => void;

beforeEach(() => {
  restore = sheetTestSetup(true);
});

afterEach(() => {
  restore();
  unstubPush();
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

  it('lets the owner make an invite link, shown once, and cancel an open one', async () => {
    const user = userEvent.setup();
    const createInvite = vi.fn().mockResolvedValue({ invite: INVITE, secret: 's3cr3t' });
    const revokeInvite = vi.fn().mockResolvedValue(undefined);
    renderSheet(() => undefined, {
      listInvites: vi.fn().mockResolvedValue([INVITE]),
      createInvite,
      revokeInvite,
    });
    await user.click(await within(sheet()).findByRole('button', { name: 'Make an invite link' }));
    const card = await within(sheet()).findByRole('group', { name: 'New invite link' });
    expect(card).toHaveTextContent(`${window.location.origin}/invite#s3cr3t`);
    await user.click(within(card).getByRole('button', { name: 'Done' }));
    expect(within(sheet()).queryByText(/s3cr3t/)).not.toBeInTheDocument();

    const open = within(sheet()).getByRole('list', { name: 'Open invite links' });
    expect(open).toHaveTextContent('Works until Oct 18, 2026');
    await user.click(within(open).getByRole('button', { name: /^Cancel invite link/ }));
    await waitFor(() => expect(revokeInvite).toHaveBeenCalledWith('i-1'));
  });

  it('shows no invites or people to an account that is not the owner, only its password', async () => {
    const listInvites = vi.fn();
    const listInvitedUsers = vi.fn();
    renderSheet(() => undefined, { listInvites, listInvitedUsers }, USER);
    expect(await within(sheet()).findByText('sam@example.com')).toBeInTheDocument();
    expect(within(sheet()).getByRole('button', { name: 'Change password' })).toBeInTheDocument();
    expect(within(sheet()).queryByText('Invite someone')).not.toBeInTheDocument();
    expect(listInvites).not.toHaveBeenCalled();
    expect(listInvitedUsers).not.toHaveBeenCalled();
  });

  it('has the notifications switch, and signing out lets this device go of its pushes', async () => {
    const user = userEvent.setup();
    const push = stubPush({ permission: 'granted', subscribed: true });
    const logout = vi.fn().mockResolvedValue(SIGNED_OUT);
    renderSheet(() => undefined, { logout });
    const toggle = within(sheet()).getByRole('switch', { name: 'Notifications on this device' });
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    await user.click(within(sheet()).getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(push.subscription.unsubscribe).toHaveBeenCalled());
  });
});

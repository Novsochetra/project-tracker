import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { describe, expect, it, vi } from 'vitest';
import { renderWithApi } from '../claude/test/renderWithApi';
import { ChangePassword } from './ChangePassword';

const form = () => screen.getByRole('form', { name: 'Change password' });

async function fill(user: ReturnType<typeof userEvent.setup>, current: string, next: string) {
  await user.click(screen.getByRole('button', { name: 'Change password' }));
  expect(within(form()).getByLabelText('Current password')).toHaveFocus();
  await user.type(within(form()).getByLabelText('Current password'), current);
  await user.type(within(form()).getByLabelText(/^New password/), next);
  await user.click(within(form()).getByRole('button', { name: 'Change password' }));
}

describe('ChangePassword', () => {
  it('sends the current and new password, then closes and says so', async () => {
    const user = userEvent.setup();
    const changePassword = vi.fn().mockResolvedValue(undefined);
    renderWithApi(<ChangePassword />, { changePassword });
    await fill(user, 'old password', 'a brand new password');
    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'old password',
        newPassword: 'a brand new password',
      }),
    );
    expect(await screen.findByText('Password changed')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Change password' })).not.toBeInTheDocument();
    expect(screen.getByText(/Other phones and browsers are signed out/)).toBeInTheDocument();
  });

  it('keeps the form open with the reason when the current password is wrong', async () => {
    const user = userEvent.setup();
    const wrong = new ApiError(400, 'invalid_input', 'Your current password is not right.');
    renderWithApi(<ChangePassword />, { changePassword: vi.fn().mockRejectedValue(wrong) });
    await fill(user, 'not it', 'a brand new password');
    expect(await within(form()).findByRole('alert')).toHaveTextContent(
      'Your current password is not right.',
    );
    await user.type(within(form()).getByLabelText('Current password'), 'x');
    expect(within(form()).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('can be closed without changing anything', async () => {
    const user = userEvent.setup();
    const changePassword = vi.fn();
    renderWithApi(<ChangePassword />, { changePassword });
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await user.click(within(form()).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Change password' })).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });
});

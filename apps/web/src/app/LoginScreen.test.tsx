import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupApi } from '../api/test/render';
import { mockPhone } from '../overlays/testing';
import { LoginScreen } from './LoginScreen';

const OWNER = { authRequired: true, authenticated: true, email: 'me@example.com' };

let restore: Array<() => void> = [];

afterEach(() => {
  restore.forEach((undo) => undo());
  restore = [];
});

function renderLogin(login: unknown = vi.fn().mockResolvedValue(OWNER), setupRequired = false) {
  const { wrapper } = setupApi({ login, getSession: vi.fn().mockResolvedValue(OWNER) });
  render(<LoginScreen setupRequired={setupRequired} />, { wrapper });
  return {
    email: screen.getByLabelText('Email'),
    password: screen.getByLabelText('Password'),
    submit: screen.getByRole('button', { name: 'Sign in' }),
  };
}

describe('LoginScreen', () => {
  it('is a sign-in form password managers recognize', () => {
    const { email, password } = renderLogin();
    expect(screen.getByRole('form', { name: 'Sign in' })).toContainElement(email);
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('name', 'email');
    expect(email).toHaveAttribute('autocomplete', 'username');
    expect(email).toHaveAttribute('inputmode', 'email');
    expect(email).toHaveAttribute('autocapitalize', 'none');
    expect(email).toHaveAttribute('spellcheck', 'false');
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('name', 'password');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    expect(password).toHaveAttribute('enterkeyhint', 'go');
  });

  it('focuses the email on desktop', () => {
    const { email } = renderLogin();
    expect(email).toHaveFocus();
  });

  it('leaves the phone keyboard down until a field is tapped', () => {
    restore.push(mockPhone(true));
    const { email } = renderLogin();
    expect(email).not.toHaveFocus();
  });

  it('moves from email to password on Return, then signs in on Return', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue(OWNER);
    const { email, password } = renderLogin(login);
    await user.type(email, 'me@example.com{Enter}');
    expect(password).toHaveFocus();
    expect(login).not.toHaveBeenCalled();
    await user.type(password, 'correct horse battery{Enter}');
    expect(login).toHaveBeenCalledWith({
      email: 'me@example.com',
      password: 'correct horse battery',
    });
  });

  it('goes to the empty field instead of sending half a sign-in', async () => {
    const user = userEvent.setup();
    const login = vi.fn();
    const { email, password, submit } = renderLogin(login);
    await user.click(submit);
    expect(email).toHaveFocus();
    await user.type(email, 'me@example.com');
    await user.click(submit);
    expect(password).toHaveFocus();
    expect(login).not.toHaveBeenCalled();
  });

  it('shows the error under the fields and clears it when a field changes', async () => {
    const user = userEvent.setup();
    const wrong = new ApiError(401, 'unauthorized', 'Email or password is incorrect.');
    const { email, password } = renderLogin(vi.fn().mockRejectedValue(wrong));
    await user.type(email, 'me@example.com');
    await user.type(password, 'nope{Enter}');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email or password is incorrect.');
    expect(email).toHaveAttribute('aria-describedby', alert.id);
    expect(password).toHaveAttribute('aria-describedby', alert.id);
    expect(password).toHaveValue('nope');
    await user.type(password, '!');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(password).not.toHaveAttribute('aria-describedby');
  });

  it('says when to try again after too many attempts, and when the tracker is unreachable', async () => {
    const user = userEvent.setup();
    const limited = new ApiError(
      429,
      'rate_limited',
      'Too many sign-in attempts. Try again in 15 minutes.',
    );
    const login = vi
      .fn()
      .mockRejectedValueOnce(limited)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { email, password } = renderLogin(login);
    await user.type(email, 'me@example.com');
    await user.type(password, 'pass{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again in 15 minutes.');
    await user.type(password, '{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the tracker.");
  });

  it('sends once while signing in', async () => {
    const user = userEvent.setup();
    let finish: (value: unknown) => void = () => undefined;
    const login = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    const { email, password } = renderLogin(login);
    await user.type(email, 'me@example.com');
    await user.type(password, 'pass{Enter}');
    const busy = screen.getByRole('button', { name: 'Signing in…' });
    expect(busy).toBeDisabled();
    await user.type(password, '{Enter}');
    expect(login).toHaveBeenCalledTimes(1);
    act(() => finish(OWNER));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled());
  });

  it('explains the setup command when there is no owner yet', () => {
    renderLogin(undefined, true);
    expect(screen.getByText('npm run owner:set -- --email you@example.com')).toBeInTheDocument();
  });
});

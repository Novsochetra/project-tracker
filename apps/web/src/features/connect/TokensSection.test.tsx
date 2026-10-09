import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import type { ApiToken, CreatedApiToken } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLICK_SHIELD_MS } from '../../lib/clickShield';
import { tap } from '../../overlays/testing';
import { renderWithApi, setClipboard, sheetTestSetup } from '../claude/test/renderWithApi';
import { TokensSection } from './TokensSection';

const NOW = new Date('2026-10-09T12:00:00').getTime();
const MINUTE = 60_000;

const laptop: ApiToken = {
  id: 'tok1',
  name: 'Claude laptop',
  hint: 'trk_AbCd',
  createdAt: new Date('2026-10-01T09:00:00').getTime(),
  lastUsedAt: NOW - 5 * MINUTE,
};
const desktop: ApiToken = {
  id: 'tok2',
  name: 'Desktop',
  hint: 'trk_WxYz',
  createdAt: new Date('2026-10-08T09:00:00').getTime(),
  lastUsedAt: null,
};
const SECRET = 'trk_9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4';
const created: CreatedApiToken = {
  token: { id: 'tok3', name: 'Work Mac', hint: 'trk_9f8e', createdAt: NOW, lastUsedAt: null },
  secret: SECRET,
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const tokenList = () => screen.getByRole('list', { name: 'Tokens' });

let restore: () => void;

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  restore = sheetTestSetup();
  Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
});

afterEach(() => {
  restore();
  vi.useRealTimers();
  setClipboard(undefined);
});

function renderTokens(tokens: ApiToken[] = [laptop, desktop], overrides = {}) {
  const server = {
    listApiTokens: vi.fn().mockResolvedValue(tokens),
    createApiToken: vi.fn().mockResolvedValue(created),
    revokeApiToken: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  renderWithApi(<TokensSection />, server);
  return { server, user: userEvent.setup() };
}

describe('TokensSection', () => {
  it('lists the tokens with their hint, when they were made and last used', async () => {
    renderTokens();
    const rows = within(await screen.findByRole('list', { name: 'Tokens' })).getAllByRole(
      'listitem',
    );
    expect(rows.map((row) => row.textContent)).toEqual([
      'Claude laptoptrk_AbCd… · Created Oct 1, 2026 · Last used 5m agoRevoke',
      'Desktoptrk_WxYz… · Created Oct 8, 2026 · Never usedRevoke',
    ]);
  });

  it('says when there are none yet', async () => {
    renderTokens([]);
    expect(await screen.findByText('No tokens yet.')).toBeInTheDocument();
  });

  it('shows a new token once, with Copy and a warning, then only its name', async () => {
    const { server, user } = renderTokens();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await screen.findByRole('list', { name: 'Tokens' });
    const create = screen.getByRole('button', { name: 'Create token' });
    expect(create).toBeDisabled();

    server.listApiTokens.mockResolvedValue([laptop, desktop, created.token]);
    await user.type(screen.getByRole('textbox', { name: 'Token name' }), '  Work Mac {Enter}');
    expect(server.createApiToken).toHaveBeenCalledWith({ name: 'Work Mac' });
    const card = await screen.findByRole('group', { name: 'New token Work Mac' });
    expect(card).toHaveFocus();
    expect(card).toHaveTextContent(
      `“Work Mac” is ready${SECRET}Copy it now. You won’t see this token again.`,
    );
    expect(within(tokenList()).getByText('Work Mac')).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Copy token' }));
    expect(writeText).toHaveBeenCalledWith(SECRET);
    expect(await screen.findByText('Token copied')).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Done' }));
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Token name' })).toHaveValue('');
  });

  it('says so when copying the token is blocked', async () => {
    const { user } = renderTokens();
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    await user.type(await screen.findByRole('textbox', { name: 'Token name' }), 'Work Mac{Enter}');
    await user.click(await screen.findByRole('button', { name: 'Copy token' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Copying was blocked here. Select the token and copy it yourself.',
    );
  });

  it('shows why a token could not be made and keeps the name', async () => {
    const refusal = new ApiError(403, 'forbidden', 'Sign in with your email and password.');
    const { user } = renderTokens([], { createApiToken: vi.fn().mockRejectedValue(refusal) });
    const name = await screen.findByRole('textbox', { name: 'Token name' });
    await user.type(name, 'Work Mac');
    await user.click(screen.getByRole('button', { name: 'Create token' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sign in with your email and password.',
    );
    expect(name).toHaveValue('Work Mac');
    expect(name).toHaveAccessibleDescription('Sign in with your email and password.');
  });

  it('revokes a token after a confirm', async () => {
    const { server, user } = renderTokens();
    await user.click(await screen.findByRole('button', { name: 'Revoke Claude laptop' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Revoke “Claude laptop”? Agents using it stop working at once.',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(server.revokeApiToken).not.toHaveBeenCalled();

    server.listApiTokens.mockResolvedValue([desktop]);
    await user.click(screen.getByRole('button', { name: 'Revoke Claude laptop' }));
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(server.revokeApiToken).toHaveBeenCalledWith('tok1');
    expect(await screen.findByText('Revoked “Claude laptop”')).toBeInTheDocument();
    expect(within(tokenList()).queryByText('Claude laptop')).not.toBeInTheDocument();
    expect(within(tokenList()).getByText('Desktop')).toBeInTheDocument();
  });

  it('revokes nothing on the second tap of a double tap', async () => {
    const { server, user } = renderTokens();
    await tap(user, await screen.findByRole('button', { name: 'Revoke Claude laptop' }));
    await tap(user, screen.getByRole('button', { name: 'Revoke' }));
    expect(server.revokeApiToken).not.toHaveBeenCalled();

    await wait(CLICK_SHIELD_MS);
    await tap(user, screen.getByRole('button', { name: 'Revoke' }));
    expect(server.revokeApiToken).toHaveBeenCalledTimes(1);
  });

  it('shows why the list could not load, with a retry', async () => {
    const listApiTokens = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue([laptop]);
    const { user } = renderTokens([], { listApiTokens });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Can't reach the tracker. Check your connection.",
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('list', { name: 'Tokens' })).toHaveTextContent('Claude laptop');
  });
});

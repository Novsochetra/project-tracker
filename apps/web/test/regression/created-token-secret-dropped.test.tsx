import type { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CreatedApiToken, ServerMeta } from '@tracker/shared';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithApi, sheetTestSetup } from '../../src/features/claude/test/renderWithApi';
import { ConnectSheet } from '../../src/features/connect/ConnectSheet';

// The reviewer of PT-125: the new token's secret is shown once, but it stayed in React Query's
// mutation cache after Done for as long as the sheet was open, and for the default gcTime (5
// minutes) after the sheet closed.

const SECRET = 'trk_9f8e7d6c5b4a39281706f5e4d3c2b1a0';
const created: CreatedApiToken = {
  token: { id: 'tok1', name: 'Work Mac', hint: 'trk_9f8e', createdAt: 0, lastUsedAt: null },
  secret: SECRET,
};
const meta: ServerMeta = {
  version: '1.0.0',
  serverUrl: 'http://localhost:4100',
  repoRoot: '/repo',
  mcpEntry: '/repo/apps/agent/dist/mcp.js',
  cliEntry: '/repo/apps/agent/dist/cli.js',
  authRequired: true,
};

const heldSecrets = (queryClient: QueryClient): unknown[] =>
  queryClient
    .getMutationCache()
    .getAll()
    .filter((mutation) => JSON.stringify(mutation.state.data ?? null).includes(SECRET));

const sheet = () => screen.queryByRole('dialog', { name: 'Connect Claude Code' });

function ClosableSheet() {
  const [open, setOpen] = useState(true);
  return <ConnectSheet open={open} onClose={() => setOpen(false)} />;
}

let restore: () => void;

beforeEach(() => {
  restore = sheetTestSetup();
});

afterEach(() => restore());

async function createToken() {
  const view = renderWithApi(<ClosableSheet />, {
    getMeta: vi.fn().mockResolvedValue(meta),
    listApiTokens: vi.fn().mockResolvedValue([]),
    createApiToken: vi.fn().mockResolvedValue(created),
  });
  const user = userEvent.setup();
  await user.type(await screen.findByRole('textbox', { name: 'Token name' }), 'Work Mac{Enter}');
  const card = await screen.findByRole('group', { name: 'New token Work Mac' });
  expect(heldSecrets(view.queryClient)).toHaveLength(1);
  return { ...view, user, card };
}

describe('regression: a new token’s secret after the card goes', () => {
  it('leaves React Query’s memory on Done', async () => {
    const { queryClient, user, card } = await createToken();
    await user.click(within(card).getByRole('button', { name: 'Done' }));
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument();
    await waitFor(() => expect(heldSecrets(queryClient)).toEqual([]));
  });

  it('leaves React Query’s memory when the sheet closes', async () => {
    const { queryClient, user } = await createToken();
    await user.click(within(sheet()!).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(sheet()).not.toBeInTheDocument());
    await waitFor(() => expect(heldSecrets(queryClient)).toEqual([]));
  });
});

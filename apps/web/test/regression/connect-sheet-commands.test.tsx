import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithApp } from '../../src/app/test/harness';
import { setClipboard, sheetTestSetup } from '../../src/features/claude/test/renderWithApi';
import { ConnectSheet } from '../../src/features/connect/ConnectSheet';

const meta = {
  version: '1.0.0',
  serverUrl: 'http://localhost:4100',
  repoRoot: '/repo',
  mcpEntry: '/repo/apps/agent/dist/mcp.js',
  cliEntry: '/repo/apps/agent/dist/cli.js',
  authRequired: false,
};

const sheet = () => screen.getByRole('dialog', { name: 'Connect Claude Code' });

function renderSheet(path: string) {
  return renderWithApp(<ConnectSheet open onClose={() => undefined} />, {
    path,
    client: { getMeta: vi.fn().mockResolvedValue(meta) },
  });
}

let restore: () => void;

beforeEach(() => {
  restore = sheetTestSetup();
});

afterEach(() => {
  restore();
  setClipboard(undefined);
});

// Under `npm run dev` the page comes from Vite, so a command built from the page's origin
// registered agents against a server that is gone under `npm start`. The slash commands only
// copied a <PROJECT KEY> placeholder.
describe('regression: the Connect sheet commands work as copied', () => {
  it('points agents at the API server from /api/meta, not at the page’s origin', async () => {
    renderSheet('/p/mob');
    const command = await within(sheet()).findByText(/^claude mcp add/);
    expect(window.location.origin).not.toBe(meta.serverUrl);
    expect(command).toHaveTextContent('--env TRACKER_URL=http://localhost:4100 --env');
  });

  it('copies the slash commands with the key of the project it was opened from', async () => {
    renderSheet('/p/mob');
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await user.click(await within(sheet()).findByRole('button', { name: 'Copy work command' }));
    expect(writeText).toHaveBeenLastCalledWith('/mcp__tracker__work MOB');
    await user.click(within(sheet()).getByRole('button', { name: 'Copy review command' }));
    expect(writeText).toHaveBeenLastCalledWith('/mcp__tracker__review MOB');
  });
});

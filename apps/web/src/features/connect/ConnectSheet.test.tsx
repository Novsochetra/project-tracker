import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ServerMeta } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithApi, setClipboard, sheetTestSetup } from '../claude/test/renderWithApi';
import { ConnectSheet } from './ConnectSheet';

const meta: ServerMeta = {
  version: '1.0.0',
  repoRoot: '/Users/dara/code/project-tracker',
  mcpEntry: '/Users/dara/code/project-tracker/apps/agent/dist/mcp.js',
  cliEntry: '/Users/dara/code/project-tracker/apps/agent/dist/cli.js',
  authRequired: false,
};

const COMMAND = `claude mcp add tracker -s user --env TRACKER_URL=${window.location.origin} --env TRACKER_AGENT_NAME=Claude -- node ${meta.mcpEntry}`;

const sheet = () => screen.getByRole('dialog', { name: 'Connect Claude Code' });

let restore: () => void;

beforeEach(() => {
  restore = sheetTestSetup();
  Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
});

afterEach(() => {
  restore();
  setClipboard(undefined);
});

describe('ConnectSheet', () => {
  it('explains the loop and shows the commands for this tracker', async () => {
    renderWithApi(<ConnectSheet open onClose={() => undefined} />, {
      getMeta: vi.fn().mockResolvedValue(meta),
    });
    expect(await within(sheet()).findByText(COMMAND)).toBeInTheDocument();
    const steps = within(sheet()).getAllByRole('listitem').slice(0, 3);
    expect(steps.map((step) => step.textContent)).toEqual([
      'Workers claim a ticket, work on it and submit it. It moves to Need review.',
      'Reviewers check the work against the ticket and rate it 1–5. They approve it to Reviewed or send it back to To do.',
      'You move reviewed work to Done. Agents never can.',
    ]);
    expect(within(sheet()).getByText('npm run build -w @tracker/agent')).toBeInTheDocument();
    expect(within(sheet()).getByText('/mcp__tracker__work <PROJECT KEY>')).toBeInTheDocument();
    expect(within(sheet()).getByText('/mcp__tracker__review <PROJECT KEY>')).toBeInTheDocument();
    expect(within(sheet()).getByText(`node ${meta.cliEntry} help`)).toBeInTheDocument();
    expect(within(sheet()).queryByText(/TRACKER_TOKEN/)).not.toBeInTheDocument();
  });

  it('adds the token to the command when the tracker needs one', async () => {
    renderWithApi(<ConnectSheet open onClose={() => undefined} />, {
      getMeta: vi.fn().mockResolvedValue({ ...meta, authRequired: true }),
    });
    expect(
      await within(sheet()).findByText(/--env TRACKER_TOKEN=<your token> -- node/),
    ).toBeInTheDocument();
    expect(within(sheet()).getByText(/with this tracker’s access token/)).toBeInTheDocument();
  });

  it('copies the command and confirms with a toast', async () => {
    renderWithApi(<ConnectSheet open onClose={() => undefined} />, {
      getMeta: vi.fn().mockResolvedValue(meta),
    });
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await user.click(await within(sheet()).findByRole('button', { name: 'Copy command' }));
    expect(writeText).toHaveBeenCalledWith(COMMAND);
    expect(await screen.findByText('Command copied')).toBeInTheDocument();

    await user.click(within(sheet()).getByRole('button', { name: 'Copy review command' }));
    expect(writeText).toHaveBeenLastCalledWith('/mcp__tracker__review <PROJECT KEY>');
  });

  it('says so when copying is blocked', async () => {
    renderWithApi(<ConnectSheet open onClose={() => undefined} />, {
      getMeta: vi.fn().mockResolvedValue(meta),
    });
    const user = userEvent.setup();
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    await user.click(await within(sheet()).findByRole('button', { name: 'Copy CLI command' }));
    expect(await within(sheet()).findByRole('alert')).toHaveTextContent(
      'Copying was blocked here. Select the command and copy it yourself.',
    );
  });

  it('shows a loading state, then an error with a retry', async () => {
    const getMeta = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(meta);
    renderWithApi(<ConnectSheet open onClose={() => undefined} />, { getMeta });
    expect(within(sheet()).getByText('Loading the setup commands')).toBeInTheDocument();
    const user = userEvent.setup();
    expect(await within(sheet()).findByRole('alert')).toHaveTextContent(
      "Can't reach the tracker. Check your connection.",
    );
    await user.click(within(sheet()).getByRole('button', { name: 'Try again' }));
    expect(await within(sheet()).findByText(COMMAND)).toBeInTheDocument();
  });
});

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ServerMeta } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DARA, makeRunner } from '../../api/test/runFixtures';
import { renderWithApp } from '../../app/test/harness';
import { renderWithApi, setClipboard, sheetTestSetup } from '../claude/test/renderWithApi';
import { ConnectSheet } from './ConnectSheet';

const meta: ServerMeta = {
  version: '1.0.0',
  serverUrl: 'http://localhost:4100',
  repoRoot: '/Users/dara/code/project-tracker',
  mcpEntry: '/Users/dara/code/project-tracker/apps/agent/dist/mcp.js',
  cliEntry: '/Users/dara/code/project-tracker/apps/agent/dist/cli.js',
  authRequired: false,
};

const COMMAND = `claude mcp add tracker -s user --env TRACKER_URL=http://localhost:4100 --env TRACKER_AGENT_NAME=Claude -- node ${meta.mcpEntry}`;

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
    expect(within(sheet()).getByText('http://localhost:4100')).toBeInTheDocument();
    expect(within(sheet()).getByText('npm run build -w @tracker/agent')).toBeInTheDocument();
    expect(within(sheet()).getByText(meta.repoRoot)).toBeInTheDocument();
    expect(within(sheet()).getByText('/mcp__tracker__work <PROJECT KEY>')).toBeInTheDocument();
    expect(within(sheet()).getByText('/mcp__tracker__review <PROJECT KEY>')).toBeInTheDocument();
    expect(within(sheet()).getByText(`node ${meta.cliEntry} help`)).toBeInTheDocument();
    expect(within(sheet()).queryByText(/TRACKER_TOKEN/)).not.toBeInTheDocument();
  });

  it('says an open tracker needs no token and leaves out the login step', async () => {
    renderWithApi(<ConnectSheet open onClose={() => undefined} />, {
      getMeta: vi.fn().mockResolvedValue(meta),
    });
    expect(
      await within(sheet()).findByText(/This tracker has no owner account, so it lets agents in/),
    ).toBeInTheDocument();
    expect(within(sheet()).queryByText(/ login --url /)).not.toBeInTheDocument();
    expect(within(sheet()).queryByRole('textbox', { name: 'Token name' })).not.toBeInTheDocument();
  });

  it('fills in the key of the project behind the sheet', async () => {
    renderWithApp(<ConnectSheet open onClose={() => undefined} />, {
      path: '/p/mob/2',
      client: { getMeta: vi.fn().mockResolvedValue(meta) },
    });
    expect(await within(sheet()).findByText('/mcp__tracker__work MOB')).toBeInTheDocument();
    expect(within(sheet()).getByText('/mcp__tracker__review MOB')).toBeInTheDocument();
    expect(
      within(sheet()).getByText(
        'MOB is this project’s key. Leave it out and the agent finds the project by its repository.',
      ),
    ).toBeInTheDocument();
  });

  it('with sign-in, shows the tokens and the step that saves one', async () => {
    renderWithApi(<ConnectSheet open onClose={() => undefined} />, {
      getMeta: vi.fn().mockResolvedValue({ ...meta, authRequired: true }),
      listApiTokens: vi.fn().mockResolvedValue([]),
    });
    expect(
      await within(sheet()).findByText(`node ${meta.cliEntry} login --url http://localhost:4100`),
    ).toBeInTheDocument();
    expect(within(sheet()).getByText(COMMAND)).toBeInTheDocument();
    expect(await within(sheet()).findByText('No tokens yet.')).toBeInTheDocument();
    expect(within(sheet()).getByRole('textbox', { name: 'Token name' })).toBeInTheDocument();
  });

  it('copies the commands and the address and confirms with a toast', async () => {
    renderWithApi(<ConnectSheet open onClose={() => undefined} />, {
      getMeta: vi.fn().mockResolvedValue(meta),
    });
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await user.click(await within(sheet()).findByRole('button', { name: 'Copy MCP command' }));
    expect(writeText).toHaveBeenCalledWith(COMMAND);
    expect(await screen.findByText('Command copied')).toBeInTheDocument();

    await user.click(within(sheet()).getByRole('button', { name: 'Copy review command' }));
    expect(writeText).toHaveBeenLastCalledWith('/mcp__tracker__review <PROJECT KEY>');

    await user.click(within(sheet()).getByRole('button', { name: 'Copy address' }));
    expect(writeText).toHaveBeenLastCalledWith('http://localhost:4100');
    expect(await screen.findByText('Address copied')).toBeInTheDocument();
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

describe('ConnectSheet: Run Claude Code from your phone', () => {
  const step = () =>
    within(sheet()).findByRole('region', { name: 'Run Claude Code from your phone' });

  it('shows the watch command for the project behind the sheet and this user’s computers', async () => {
    const studio = makeRunner({
      id: 'h-studio',
      name: 'Studio',
      online: false,
      lastSeenAt: Date.now() - 2 * 60 * 60 * 1000,
    });
    renderWithApp(<ConnectSheet open onClose={() => undefined} />, {
      path: '/p/mob/2',
      client: {
        getMeta: vi.fn().mockResolvedValue(meta),
        listRunners: vi
          .fn()
          .mockResolvedValue([makeRunner({ projectKeys: ['MOB', 'WEB'] }), studio]),
      },
    });
    const section = await step();
    const command = `node ${meta.cliEntry} watch MOB`;
    expect(within(section).getByText(command)).toBeInTheDocument();
    expect(
      within(section).getByText(
        "Your Mac has to be on, awake and logged in; after a restart with FileVault it waits for your password. If it is off, asleep or offline, a run waits 30 minutes, then stops with “Your computer didn't take the run.”",
      ),
    ).toBeInTheDocument();
    const computers = await within(section).findByRole('list', { name: 'Your computers' });
    expect(
      within(computers)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual([`${DARA}MOB, WEB · Online`, 'StudioMOB · Last seen 2h ago']);

    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await user.click(within(section).getByRole('button', { name: 'Copy watch command' }));
    expect(writeText).toHaveBeenCalledWith(command);
  });

  it('says when no computer runs it yet', async () => {
    renderWithApi(<ConnectSheet open onClose={() => undefined} />, {
      getMeta: vi.fn().mockResolvedValue(meta),
      listRunners: vi.fn().mockResolvedValue([]),
    });
    const section = await step();
    expect(await within(section).findByText('No computers yet.')).toBeInTheDocument();
    expect(within(section).getByText(`node ${meta.cliEntry} watch`)).toBeInTheDocument();
  });
});

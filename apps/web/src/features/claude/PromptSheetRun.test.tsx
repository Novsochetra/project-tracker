import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import type { Run, Runner } from '@tracker/shared';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, STATUS } from '../../api/test/fixtures';
import { DARA, makeRun, makeRunner } from '../../api/test/runFixtures';
import { useSheets } from '../../app/sheets/context';
import { SheetsProvider } from '../../app/sheets/SheetsProvider';
import { LAST_HELPER_STORAGE_KEY } from './lastHelper';
import { PromptSheet } from './PromptSheet';
import { PROMPT_HELP, RUN_PROMPT_HELP } from './sendPrompt';
import { renderWithApi, setClipboard, sheetTestSetup } from './test/renderWithApi';

const PROMPT = 'Please work on ticket MOB-1 from my "Mobile app" project.';
const scope = { kind: 'ticket', ticketKey: 'MOB-1' } as const;
const dara = makeRunner();
const studio = makeRunner({ id: 'h-studio', name: 'Studio' });

function Harness() {
  const [open, setOpen] = useState(true);
  return <PromptSheet open={open} onClose={() => setOpen(false)} scope={scope} />;
}

function Opener() {
  const sheets = useSheets();
  return (
    <button type="button" onClick={() => sheets.open({ type: 'prompt', scope })}>
      Open sheet
    </button>
  );
}

function client(runners: Runner[], runs: Run[] = []) {
  const detail = makeTicketDetail(listItem(1, STATUS.todo, 0));
  return {
    getTicketPrompt: vi.fn().mockResolvedValue({ text: PROMPT, ticketCount: 1 }),
    getTicket: vi.fn().mockResolvedValue(detail),
    markSent: vi.fn().mockResolvedValue(detail.ticket),
    listRunners: vi.fn().mockResolvedValue(runners),
    listTicketRuns: vi.fn().mockResolvedValue(runs),
    startRun: vi.fn((ticketKey: string, input: { runnerId: string }) =>
      Promise.resolve(makeRun({ ticketKey, runnerId: input.runnerId })),
    ),
  };
}

const promptBox = () => screen.findByRole('textbox', { name: 'Prompt for Claude Code' });
const runButton = () => screen.findByRole('button', { name: 'Run in Claude Code' });
const copyButton = () => screen.getByRole('button', { name: 'Copy prompt' });
const sendSwitch = () => screen.queryByRole('switch', { name: 'Move to In progress when sent' });
const comesBefore = (first: Element, second: Element) =>
  Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

let restore: () => void;

beforeEach(() => {
  localStorage.clear();
  restore = sheetTestSetup();
});

afterEach(() => {
  restore();
  setClipboard(undefined);
});

describe('PromptSheet with a helper online', () => {
  it('runs the edited text on the helper, then closes and says where it went', async () => {
    const api = client([dara]);
    renderWithApi(<Harness />, api);
    const user = userEvent.setup();
    await user.type(await promptBox(), ' Thanks!');
    const run = await runButton();

    expect(comesBefore(copyButton(), run)).toBe(true);
    expect(screen.getByText(RUN_PROMPT_HELP)).toBeInTheDocument();
    expect(screen.queryByText(/set up your computer/)).not.toBeInTheDocument();
    await user.click(run);

    expect(api.startRun).toHaveBeenCalledWith('MOB-1', {
      runnerId: dara.id,
      prompt: `${PROMPT} Thanks!`,
    });
    expect(await screen.findByText(`Sent to Claude on ${DARA}`)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(localStorage.getItem(LAST_HELPER_STORAGE_KEY)).toBe(dara.id);
    expect(api.markSent).not.toHaveBeenCalled();
  });

  it('keeps the switch for Copy, which Run leaves alone', async () => {
    const api = client([dara]);
    renderWithApi(<Harness />, api);
    const user = userEvent.setup();
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    await promptBox();
    await runButton();
    expect(sendSwitch()).toBeChecked();
    await user.click(copyButton());
    await waitFor(() =>
      expect(api.markSent).toHaveBeenCalledWith('MOB-1', { moveToInProgress: true }),
    );
  });

  it('puts Run first on phones, where the buttons stack', async () => {
    restore();
    restore = sheetTestSetup(true);
    renderWithApi(<Harness />, client([dara]));
    await promptBox();
    expect(comesBefore(await runButton(), copyButton())).toBe(true);
  });

  it('shows a refusal in the sheet and stays open', async () => {
    const api = client([dara]);
    api.startRun.mockRejectedValue(
      new ApiError(409, 'conflict', `${DARA} doesn't run MOB. Start tracker watch there.`),
    );
    renderWithApi(<Harness />, api);
    const user = userEvent.setup();
    await promptBox();
    await user.click(await runButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      `${DARA} doesn't run MOB. Start tracker watch there.`,
    );
    expect(screen.getByRole('dialog', { name: 'Send to Claude Code' })).toBeInTheDocument();
  });
});

describe('PromptSheet with several helpers online', () => {
  it('starts on the helper used last and runs on the one picked', async () => {
    localStorage.setItem(LAST_HELPER_STORAGE_KEY, studio.id);
    const api = client([dara, studio, makeRunner({ id: 'h-old', name: 'Old', online: false })]);
    renderWithApi(<Harness />, api);
    const user = userEvent.setup();
    await promptBox();
    const runOn = await screen.findByRole('button', { name: /^Run on/ });
    expect(runOn).toHaveTextContent('Studio');

    await user.click(runOn);
    const options = within(screen.getByRole('listbox', { name: 'Run on' })).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([DARA, 'Studio']);
    await user.click(options[0]!);
    await user.click(await runButton());

    expect(api.startRun).toHaveBeenCalledWith('MOB-1', { runnerId: dara.id, prompt: PROMPT });
    await waitFor(() => expect(localStorage.getItem(LAST_HELPER_STORAGE_KEY)).toBe(dara.id));
  });

  it('has no Run on row for a single helper', async () => {
    renderWithApi(<Harness />, client([dara]));
    await promptBox();
    await runButton();
    expect(screen.queryByRole('button', { name: /^Run on/ })).not.toBeInTheDocument();
  });
});

describe('PromptSheet without a helper online', () => {
  it('keeps Copy and the switch, and offers to set up the computer', async () => {
    const offline = makeRunner({ online: false });
    const web = makeRunner({ id: 'h-web', projectKeys: ['WEB'] });
    const api = {
      ...client([offline, web]),
      getMeta: vi.fn().mockResolvedValue({
        serverUrl: 'http://localhost:4100',
        repoRoot: '/repo',
        mcpEntry: '/repo/apps/agent/dist/mcp.js',
        cliEntry: '/repo/apps/agent/dist/cli.js',
        authRequired: false,
        version: '1',
      }),
    };
    renderWithApi(
      <SheetsProvider>
        <Opener />
      </SheetsProvider>,
      api,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open sheet' }));
    await promptBox();
    const setUp = await screen.findByRole('button', { name: 'set up your computer' });

    expect(setUp.parentElement).toHaveTextContent(
      'Run Claude Code from here: set up your computer',
    );
    expect(screen.queryByRole('button', { name: 'Run in Claude Code' })).not.toBeInTheDocument();
    expect(copyButton()).toBeInTheDocument();
    expect(sendSwitch()).toBeChecked();

    await user.click(setUp);
    expect(await screen.findByRole('dialog', { name: 'Connect Claude Code' })).toBeInTheDocument();
  });
});

describe('PromptSheet while Claude works on the ticket', () => {
  it('says where Claude works instead of offering Run, and keeps Copy', async () => {
    renderWithApi(<Harness />, client([dara], [makeRun({ status: 'running' })]));
    await promptBox();
    expect(await screen.findByText(`Claude is working on ${DARA}…`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run in Claude Code' })).not.toBeInTheDocument();
    expect(copyButton()).toBeInTheDocument();
    expect(screen.getByText(PROMPT_HELP)).toBeInTheDocument();
  });
});

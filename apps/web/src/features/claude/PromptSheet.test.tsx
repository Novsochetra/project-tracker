import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, project, STATUS, statuses } from '../../api/test/fixtures';
import type { PromptScope } from '../../app/sheets/types';
import { PromptSheet } from './PromptSheet';
import { COPY_BLOCKED } from './sendPrompt';
import { renderWithApi, setClipboard, setShare, sheetTestSetup } from './test/renderWithApi';

const PROMPT = 'Please work on ticket MOB-1 from my "Mobile app" project.';
const ticketScope: PromptScope = { kind: 'ticket', ticketKey: 'MOB-1' };
const projectScope: PromptScope = { kind: 'project', projectKey: 'MOB' };

function Harness({ scope }: { scope: PromptScope }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open sheet
      </button>
      <PromptSheet open={open} onClose={() => setOpen(false)} scope={scope} />
    </>
  );
}

function ticketClient(statusId: string = STATUS.todo) {
  const detail = makeTicketDetail(listItem(1, statusId, 0));
  return {
    getTicketPrompt: vi.fn().mockResolvedValue({ text: PROMPT, ticketCount: 1 }),
    getTicket: vi.fn().mockResolvedValue(detail),
    markSent: vi.fn().mockResolvedValue({ ...detail.ticket, statusId: STATUS.progress }),
  };
}

const promptBox = () => screen.findByRole('textbox', { name: 'Prompt for Claude Code' });
const sendSwitch = () => screen.queryByRole('switch', { name: 'Move to In progress when sent' });

let restore: () => void;

beforeEach(() => {
  restore = sheetTestSetup();
  Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
});

afterEach(() => {
  restore();
  setClipboard(undefined);
  setShare(undefined);
});

describe('PromptSheet for a ticket', () => {
  it('loads the server prompt with the subtitle and the switch on', async () => {
    renderWithApi(<Harness scope={ticketScope} />, ticketClient());
    expect(await promptBox()).toHaveValue(PROMPT);
    expect(screen.getByRole('dialog', { name: 'Send to Claude Code' })).toBeInTheDocument();
    expect(await screen.findByText('MOB-1 · Mobile app')).toBeInTheDocument();
    expect(screen.getByText('Move MOB-1 to In progress')).toBeInTheDocument();
    expect(sendSwitch()).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Share prompt' })).not.toBeInTheDocument();
  });

  it('copies the edited text, toasts, and sends and moves the ticket once', async () => {
    const client = ticketClient();
    renderWithApi(<Harness scope={ticketScope} />, client);
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await user.type(await promptBox(), ' Thanks!');
    await screen.findByRole('switch');

    await user.click(screen.getByRole('button', { name: 'Copy prompt' }));
    expect(writeText).toHaveBeenCalledWith(`${PROMPT} Thanks!`);
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(screen.getByText('Prompt copied')).toBeInTheDocument();
    await waitFor(() =>
      expect(client.markSent).toHaveBeenCalledWith('MOB-1', { moveToInProgress: true }),
    );
    expect(sendSwitch()).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copied' }));
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(client.markSent).toHaveBeenCalledTimes(1);
  });

  it('only logs the send when the switch is off', async () => {
    const client = ticketClient();
    renderWithApi(<Harness scope={ticketScope} />, client);
    const user = userEvent.setup();
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    await promptBox();
    await user.click(await screen.findByRole('switch'));
    expect(sendSwitch()).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Copy prompt' }));
    await waitFor(() =>
      expect(client.markSent).toHaveBeenCalledWith('MOB-1', { moveToInProgress: false }),
    );
  });

  it('asks the person to copy by hand when copying is blocked', async () => {
    const client = ticketClient();
    renderWithApi(<Harness scope={ticketScope} />, client);
    const user = userEvent.setup();
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    await promptBox();
    await user.click(screen.getByRole('button', { name: 'Copy prompt' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(COPY_BLOCKED);
    expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeInTheDocument();
    expect(client.markSent).not.toHaveBeenCalled();
  });

  it('has no switch for a ticket that is already in progress', async () => {
    const client = ticketClient(STATUS.progress);
    renderWithApi(<Harness scope={ticketScope} />, client);
    await promptBox();
    await waitFor(() => expect(client.getTicket).toHaveBeenCalled());
    expect(sendSwitch()).not.toBeInTheDocument();
  });

  it('shares the prompt and marks the ticket sent without a toast', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setShare(share);
    const client = ticketClient();
    renderWithApi(<Harness scope={ticketScope} />, client);
    const user = userEvent.setup();
    await promptBox();
    await screen.findByRole('switch');
    await user.click(screen.getByRole('button', { name: 'Share prompt' }));
    expect(share).toHaveBeenCalledWith({ title: 'Prompt for Claude Code', text: PROMPT });
    await waitFor(() =>
      expect(client.markSent).toHaveBeenCalledWith('MOB-1', { moveToInProgress: true }),
    );
    expect(screen.queryByText('Prompt copied')).not.toBeInTheDocument();
  });

  it('starts fresh on every opening', async () => {
    const client = ticketClient();
    renderWithApi(<Harness scope={ticketScope} />, client);
    const user = userEvent.setup();
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    await user.type(await promptBox(), ' edited');
    await screen.findByRole('switch');
    await user.click(screen.getByRole('button', { name: 'Copy prompt' }));
    await waitFor(() => expect(client.markSent).toHaveBeenCalledTimes(1));

    const dialog = screen.getByRole('dialog', { name: 'Send to Claude Code' });
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const fetchesBefore = client.getTicketPrompt.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Open sheet' }));

    await waitFor(() => expect(client.getTicketPrompt).toHaveBeenCalledTimes(fetchesBefore + 1));
    await waitFor(async () => expect(await promptBox()).toHaveValue(PROMPT));
    expect(await screen.findByRole('switch')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeInTheDocument();
  });

  it('shows a load error with a retry', async () => {
    const client = {
      ...ticketClient(),
      getTicketPrompt: vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValue({ text: PROMPT, ticketCount: 1 }),
    };
    renderWithApi(<Harness scope={ticketScope} />, client);
    const user = userEvent.setup();
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the tracker.");
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await promptBox()).toHaveValue(PROMPT);
  });
});

describe('PromptSheet for a project', () => {
  const detail = { project, statuses };

  it('lists the open ticket count and never marks anything sent', async () => {
    const client = {
      getProjectPrompt: vi
        .fn()
        .mockResolvedValue({ text: 'Here are the open tickets', ticketCount: 2 }),
      getProject: vi.fn().mockResolvedValue(detail),
    };
    renderWithApi(<Harness scope={projectScope} />, client);
    const user = userEvent.setup();
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    expect(await promptBox()).toHaveValue('Here are the open tickets');
    expect(await screen.findByText('2 open tickets · Mobile app')).toBeInTheDocument();
    expect(sendSwitch()).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy prompt' }));
    expect(await screen.findByText('Prompt copied')).toBeInTheDocument();
  });

  it('says so when there are no open tickets, without a box or Copy button', async () => {
    setShare(vi.fn());
    const client = {
      getProjectPrompt: vi.fn().mockResolvedValue({ text: '', ticketCount: 0 }),
      getProject: vi.fn().mockResolvedValue(detail),
    };
    renderWithApi(<Harness scope={projectScope} />, client);
    expect(
      await screen.findByText('There are no open tickets in this project.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('0 open tickets · Mobile app')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy prompt' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Share prompt' })).not.toBeInTheDocument();
  });
});

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import type { ReportPreview } from '@tracker/shared';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { project, statuses } from '../../api/test/fixtures';
import { flashRows } from '../../app/flash';
import type { ReportScope } from '../../app/sheets/types';
import { ReportSheet } from './ReportSheet';
import { renderWithApi, setClipboard, sheetTestSetup } from './test/renderWithApi';

vi.mock('../../app/flash', () => ({ flashRows: vi.fn() }));

const REPORT = ['**TICKET:** MOB-1', 'STATUS: done', 'TICKET: MOB-9', 'STATUS: done'].join('\n');
const projectScope: ReportScope = { kind: 'project', projectKey: 'MOB' };
const ticketScope: ReportScope = { kind: 'ticket', ticketKey: 'MOB-3', projectKey: 'MOB' };

const preview: ReportPreview = {
  items: [
    {
      key: 'MOB-1',
      matched: true,
      ticketKey: 'MOB-1',
      ticketTitle: 'Login error',
      fromStatusName: 'In progress',
      toStatusName: 'Need review',
    },
    {
      key: 'MOB-9',
      matched: false,
      ticketKey: null,
      ticketTitle: null,
      fromStatusName: null,
      toStatusName: null,
    },
  ],
  matchedCount: 1,
};

function Harness({ scope }: { scope: ReportScope }) {
  const [open, setOpen] = useState(true);
  return <ReportSheet open={open} onClose={() => setOpen(false)} scope={scope} />;
}

function client(overrides: Record<string, unknown> = {}) {
  return {
    getProject: vi.fn().mockResolvedValue({ project, statuses }),
    previewReport: vi.fn().mockResolvedValue(preview),
    applyReport: vi.fn().mockResolvedValue({ updatedTicketKeys: ['MOB-1'] }),
    ...overrides,
  };
}

const dialog = () => screen.getByRole('dialog', { name: 'Paste Claude Code report' });
const applyButton = () => within(dialog()).getByRole('button', { name: 'Apply' });

async function enterReport(text: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('textbox', { name: 'Report' }));
  await user.paste(text);
  return user;
}

let restore: () => void;

beforeEach(() => {
  restore = sheetTestSetup();
  vi.mocked(flashRows).mockClear();
});

afterEach(() => {
  restore();
  setClipboard(undefined);
});

describe('ReportSheet', () => {
  it('previews a project report and applies it', async () => {
    const api = client();
    renderWithApi(<Harness scope={projectScope} />, api);
    expect(screen.getByText(/Each block that starts with “TICKET: KEY-123”/)).toBeInTheDocument();
    expect(await screen.findByText('Mobile app')).toBeInTheDocument();
    expect(applyButton()).toBeDisabled();

    const user = await enterReport(REPORT);
    expect(await screen.findByText('In progress → Need review')).toBeInTheDocument();
    expect(screen.getByText('Changes')).toBeInTheDocument();
    expect(screen.getByText('Skipped')).toBeInTheDocument();
    expect(screen.getByText('No ticket with this ID')).toBeInTheDocument();
    expect(api.previewReport).toHaveBeenLastCalledWith({ text: REPORT, ticketKey: undefined });

    await user.click(applyButton());
    expect(api.applyReport).toHaveBeenCalledWith({ text: REPORT, ticketKey: undefined });
    expect(await screen.findByText('Report applied to 1 ticket')).toBeInTheDocument();
    expect(flashRows).toHaveBeenCalledWith(['MOB-1']);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sends the ticket key in ticket scope so keyless text goes to that ticket', async () => {
    const keyless: ReportPreview = {
      items: [{ ...preview.items[0]!, key: null, ticketKey: 'MOB-3', toStatusName: null }],
      matchedCount: 1,
    };
    const api = client({ previewReport: vi.fn().mockResolvedValue(keyless) });
    renderWithApi(<Harness scope={ticketScope} />, api);
    expect(screen.getByText(/With no TICKET line, it’s added to MOB-3\./)).toBeInTheDocument();
    expect(within(dialog()).getByText('MOB-3')).toBeInTheDocument();

    await enterReport('Fixed the crash.');
    expect(await screen.findByText('Add report')).toBeInTheDocument();
    expect(api.previewReport).toHaveBeenLastCalledWith({
      text: 'Fixed the crash.',
      ticketKey: 'MOB-3',
    });
    expect(applyButton()).toBeEnabled();
  });

  it('keeps Apply disabled while no block matches a ticket', async () => {
    const unmatched: ReportPreview = {
      items: [{ ...preview.items[1]!, key: null }],
      matchedCount: 0,
    };
    renderWithApi(
      <Harness scope={projectScope} />,
      client({ previewReport: vi.fn().mockResolvedValue(unmatched) }),
    );
    await enterReport('Some text without a key');
    expect(await screen.findByText('No TICKET line found')).toBeInTheDocument();
    expect(applyButton()).toBeDisabled();
  });

  it('explains a report that matched nothing when applied', async () => {
    const api = client({
      applyReport: vi.fn().mockRejectedValue(new ApiError(422, 'no_match', 'No match')),
    });
    renderWithApi(<Harness scope={projectScope} />, api);
    const user = await enterReport(REPORT);
    await screen.findByText('In progress → Need review');
    await user.click(applyButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No matching ticket found. The report needs a line like “TICKET: MOB-1”.',
    );
    expect(dialog()).toBeInTheDocument();
    expect(flashRows).not.toHaveBeenCalled();
  });

  it('says when the preview can’t reach the tracker', async () => {
    renderWithApi(
      <Harness scope={projectScope} />,
      client({ previewReport: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) }),
    );
    await enterReport(REPORT);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Can't reach the tracker. Check your connection.",
    );
    expect(applyButton()).toBeDisabled();
  });

  it('pastes the clipboard into the box', async () => {
    renderWithApi(<Harness scope={projectScope} />, client());
    const user = userEvent.setup();
    setClipboard({ readText: vi.fn().mockResolvedValue(REPORT) });
    await user.click(screen.getByRole('button', { name: 'Paste from clipboard' }));
    expect(screen.getByRole('textbox', { name: 'Report' })).toHaveValue(REPORT);
    expect(await screen.findByText('In progress → Need review')).toBeInTheDocument();
  });

  it.each([
    [{ readText: vi.fn().mockResolvedValue('  ') }, 'The clipboard is empty.'],
    [
      { readText: vi.fn().mockRejectedValue(new DOMException('', 'NotAllowedError')) },
      'Clipboard access was blocked. Paste into the box instead.',
    ],
    [{}, 'Clipboard access isn’t available here. Paste into the box instead.'],
  ])('shows why the clipboard could not be read', async (clipboard, message) => {
    renderWithApi(<Harness scope={projectScope} />, client());
    const user = userEvent.setup();
    setClipboard(clipboard);
    await user.click(screen.getByRole('button', { name: 'Paste from clipboard' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    await user.type(screen.getByRole('textbox', { name: 'Report' }), 'x');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

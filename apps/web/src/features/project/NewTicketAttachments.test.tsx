import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UploadOptions } from '@tracker/client';
import {
  ATTACHMENT_ACCEPT,
  UNSUPPORTED_ATTACHMENT_MESSAGE,
  type Attachment,
} from '@tracker/shared';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../api';
import { deferred } from '../../api/test/deferred';
import { attachment, listItem, makeBoard, STATUS } from '../../api/test/fixtures';
import { setupApi } from '../../api/test/render';
import { ToastProvider } from '../../components';
import { sheetDraft } from '../../lib/sheetDrafts';
import { mockPhone, skipAnimations } from '../../overlays/testing';
import { NewTicketSheet } from './NewTicketSheet';

const { commentCount: _c, attachmentCount: _a, ...created } = listItem(5, STATUS.todo, -1000);

const pending = (id: string, fileName: string, mimeType: string): Attachment =>
  attachment(id, { ticketId: null, fileName, mimeType, createdAt: Date.now() });

const crashLog = () => new File(['boom'], 'crash.log', { type: 'text/plain' });

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open sheet
      </button>
      <NewTicketSheet open={open} projectKey="MOB" onClose={() => setOpen(false)} />
    </>
  );
}

type Overrides = Parameters<typeof setupApi>[0];

function renderSheet(overrides: Overrides = {}) {
  const api = setupApi({
    createTicket: vi.fn().mockResolvedValue(created),
    getBoard: vi.fn().mockResolvedValue(makeBoard()),
    listPeople: vi.fn().mockResolvedValue([]),
    deleteAttachment: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });
  api.queryClient.setQueryData(queryKeys.board('MOB'), makeBoard());
  const Wrapper = api.wrapper;
  render(
    <Wrapper>
      <ToastProvider>
        <Harness />
      </ToastProvider>
    </Wrapper>,
  );
  return { ...api, user: userEvent.setup({ applyAccept: false }) };
}

const dialog = () => screen.getByRole('dialog', { name: 'New ticket' });
const titleField = () => screen.getByLabelText('Ticket title');
const createButton = () => within(dialog()).getByRole('button', { name: 'Create' });
const fileInput = () => screen.getByLabelText('Add files to ticket');

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  localStorage.clear();
});

describe('New ticket attachments', () => {
  it('offers to attach any kind of file, beside the description', () => {
    renderSheet();
    expect(within(dialog()).getByRole('button', { name: 'Add files' })).toBeInTheDocument();
    expect(fileInput()).toHaveAttribute('accept', ATTACHMENT_ACCEPT);
    expect(fileInput()).toHaveAttribute('multiple');
  });

  it('shows the progress of each file and creates the ticket with them once they are up', async () => {
    const upload = deferred<Attachment>();
    let report: UploadOptions['onProgress'];
    const uploadAttachment = vi.fn(
      (_file: Blob, _name: string, _key?: string, options?: UploadOptions) => {
        report = options?.onProgress;
        return upload.promise;
      },
    );
    const { user, client } = renderSheet({ uploadAttachment });
    await user.type(titleField(), 'Crash on rotate');
    await user.upload(fileInput(), crashLog());

    const bar = await screen.findByRole('progressbar', { name: 'Uploading crash.log' });
    expect(vi.mocked(client.uploadAttachment).mock.calls[0]?.[2]).toBeUndefined();
    expect(createButton()).toBeDisabled();
    act(() => report?.(2, 4));
    expect(bar).toHaveAttribute('aria-valuenow', '50');

    upload.resolve(pending('log', 'crash.log', 'text/plain'));
    await waitFor(() => expect(createButton()).toBeEnabled());
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(within(dialog()).getByText('crash.log')).toBeInTheDocument();
    await user.click(createButton());
    expect(client.createTicket).toHaveBeenCalledWith(
      'MOB',
      expect.objectContaining({ title: 'Crash on rotate', attachmentIds: ['log'] }),
    );
    expect(await screen.findByText('MOB-5 created')).toBeInTheDocument();
    expect(client.deleteAttachment).not.toHaveBeenCalled();
  });

  it('attaches files dropped on the sheet or pasted into its text', async () => {
    const uploadAttachment = vi
      .fn()
      .mockResolvedValueOnce(pending('a', 'notes.md', 'text/markdown'))
      .mockResolvedValueOnce(pending('b', 'shot.png', 'image/png'));
    const { client } = renderSheet({ uploadAttachment });
    const notes = new File(['# Notes'], 'notes.md', { type: '' });
    const description = within(dialog()).getByLabelText('Description');
    const dataTransfer = { types: ['Files'], files: [notes], items: [] };
    fireEvent.dragEnter(description, { dataTransfer });
    expect(within(dialog()).getByText('Drop files to attach')).toBeInTheDocument();
    fireEvent.drop(description, { dataTransfer });
    await waitFor(() => expect(client.uploadAttachment).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
    expect(within(dialog()).getByText('notes.md')).toBeInTheDocument();

    const shot = new File(['png'], 'shot.png', { type: 'image/png' });
    const paste = createEvent.paste(description, {
      clipboardData: { files: [shot], items: [], types: ['Files'] },
    });
    fireEvent(description, paste);
    expect(paste.defaultPrevented).toBe(true);
    expect(await within(dialog()).findByRole('img', { name: 'Image 1' })).toBeInTheDocument();
    expect(client.uploadAttachment).toHaveBeenCalledTimes(2);
  });

  it('refuses files it cannot attach and says what it can', async () => {
    const { user, client } = renderSheet();
    await user.upload(fileInput(), new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }));
    expect(await screen.findByText(UNSUPPORTED_ATTACHMENT_MESSAGE)).toBeInTheDocument();
    expect(client.uploadAttachment).not.toHaveBeenCalled();
  });

  it('removes a file and tells the server to drop it', async () => {
    const uploadAttachment = vi.fn().mockResolvedValue(pending('log', 'crash.log', 'text/plain'));
    const { user, client } = renderSheet({ uploadAttachment });
    await user.upload(fileInput(), crashLog());
    await user.click(await screen.findByRole('button', { name: 'Remove crash.log' }));
    expect(client.deleteAttachment).toHaveBeenCalledWith('log');
    expect(within(dialog()).queryByText('crash.log')).not.toBeInTheDocument();
    expect(sheetDraft('new-ticket:MOB')).toBeUndefined();
  });

  it('counts a file as a change: a phone asks before discarding, then deletes the upload', async () => {
    restore.push(mockPhone(true));
    const uploadAttachment = vi.fn().mockResolvedValue(pending('log', 'crash.log', 'text/plain'));
    const { user, client } = renderSheet({ uploadAttachment });
    await user.upload(fileInput(), crashLog());
    expect(await within(dialog()).findByText('crash.log')).toBeInTheDocument();

    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    const ask = screen.getByRole('dialog', { name: 'Discard changes?' });
    await user.click(within(ask).getByRole('button', { name: 'Discard changes' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'New ticket' })).not.toBeInTheDocument(),
    );
    expect(client.deleteAttachment).toHaveBeenCalledWith('log');
  });

  it('counts a file still uploading as a change, and stops it when the sheet is discarded', async () => {
    restore.push(mockPhone(true));
    let signal: AbortSignal | undefined;
    const uploadAttachment = vi.fn((_f: Blob, _n: string, _k?: string, options?: UploadOptions) => {
      signal = options?.signal;
      return new Promise<Attachment>(() => undefined);
    });
    const { user } = renderSheet({ uploadAttachment });
    await user.upload(fileInput(), crashLog());
    await screen.findByRole('progressbar', { name: 'Uploading crash.log' });

    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    const ask = screen.getByRole('dialog', { name: 'Discard changes?' });
    await user.click(within(ask).getByRole('button', { name: 'Discard changes' }));
    expect(signal?.aborted).toBe(true);
  });

  it('brings uploaded files back with the kept fields after a reload', async () => {
    const uploadAttachment = vi.fn().mockResolvedValue(pending('log', 'crash.log', 'text/plain'));
    const first = renderSheet({ uploadAttachment });
    await first.user.upload(fileInput(), crashLog());
    expect(await within(dialog()).findByText('crash.log')).toBeInTheDocument();
    cleanup();

    const { user, client } = renderSheet();
    expect(within(dialog()).getByText('crash.log')).toBeInTheDocument();
    await user.type(titleField(), 'From before{Enter}');
    expect(client.createTicket).toHaveBeenCalledWith(
      'MOB',
      expect.objectContaining({ title: 'From before', attachmentIds: ['log'] }),
    );
  });
});

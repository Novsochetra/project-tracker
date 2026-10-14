import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_ASK_OPTIONS, type ChatDetail } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAskRun, makeChatDetail, makeMessage } from '../../api/test/chatFixtures';
import { deferred } from '../../api/test/deferred';
import { attachment } from '../../api/test/fixtures';
import { makeRunner } from '../../api/test/runFixtures';
import { renderAsk } from './test/renderAsk';

const dara = makeRunner();
const question = () => screen.findByRole('textbox', { name: 'Question for Claude' });
const sendButton = () => screen.getByRole('button', { name: 'Send' });
const board = () => new File(['png'], 'board.png', { type: 'image/png' });

let restore: () => void;

beforeEach(() => localStorage.clear());
afterEach(() => restore());

function setup(detail: ChatDetail, client: Record<string, unknown> = {}) {
  const rendered = renderAsk({
    path: `/p/MOB/ask/${detail.chat.id}`,
    client: {
      getChat: vi.fn().mockResolvedValue(detail),
      listRunners: vi.fn().mockResolvedValue([dara]),
      ...client,
    },
  });
  restore = rendered.restore;
  return rendered;
}

describe('Ask: files sent with a question', () => {
  it('uploads a picked photo, waits for it, then sends its id with the question', async () => {
    const upload = deferred<ReturnType<typeof attachment>>();
    const detail = makeChatDetail();
    const ask = vi.fn().mockResolvedValue({ ...detail, run: makeAskRun() });
    const { client } = setup(detail, {
      uploadAttachment: vi.fn().mockReturnValue(upload.promise),
      ask,
    });
    const user = userEvent.setup();
    await user.type(await question(), 'Turn this into tickets');
    await user.upload(screen.getByLabelText('Attach files to question'), board());
    expect(
      await screen.findByRole('progressbar', { name: 'Uploading board.png' }),
    ).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
    expect(vi.mocked(client.uploadAttachment).mock.calls[0]?.[2]).toBeUndefined();

    upload.resolve(attachment('board', { ticketId: null }));
    await waitFor(() => expect(sendButton()).toBeEnabled());
    expect(screen.getByRole('img', { name: 'Image 1' })).toBeInTheDocument();
    await user.click(sendButton());
    expect(client.ask).toHaveBeenCalledWith('c-1', {
      runnerId: dara.id,
      text: 'Turn this into tickets',
      attachmentIds: ['board'],
      ...DEFAULT_ASK_OPTIONS,
    });
    await waitFor(() => expect(screen.queryByRole('img', { name: 'Image 1' })).toBeNull());
  });

  it('leaves out a file its x removed before Send', async () => {
    const detail = makeChatDetail();
    const notes = attachment('notes', {
      ticketId: null,
      fileName: 'notes.txt',
      mimeType: 'text/plain',
    });
    const photo = attachment('board', { ticketId: null });
    const ask = vi.fn().mockResolvedValue({ ...detail, run: makeAskRun() });
    setup(detail, {
      uploadAttachment: vi.fn((file: File) =>
        Promise.resolve(file.name === 'notes.txt' ? notes : photo),
      ),
      ask,
    });
    const user = userEvent.setup();
    await user.type(await question(), 'Look at the log');
    const notesFile = new File(['ok'], 'notes.txt', { type: 'text/plain' });
    await user.upload(screen.getByLabelText('Attach files to question'), [board(), notesFile]);
    await user.click(await screen.findByRole('button', { name: 'Remove image 1' }));
    expect(screen.queryByRole('img', { name: 'Image 1' })).toBeNull();
    await waitFor(() => expect(sendButton()).toBeEnabled());
    await user.click(sendButton());
    expect(ask).toHaveBeenCalledWith('c-1', expect.objectContaining({ attachmentIds: ['notes'] }));
  });

  it('keeps the files when the tracker refuses the question', async () => {
    const detail = makeChatDetail();
    setup(detail, {
      uploadAttachment: vi.fn().mockResolvedValue(attachment('board', { ticketId: null })),
      ask: vi.fn().mockRejectedValue(new Error('Some files could not be sent.')),
    });
    const user = userEvent.setup();
    await user.type(await question(), 'Look');
    await user.upload(screen.getByLabelText('Attach files to question'), board());
    await waitFor(() => expect(sendButton()).toBeEnabled());
    await user.click(sendButton());
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Image 1' })).toBeInTheDocument();
  });

  it("shows the files on the person's message, which open in the viewer", async () => {
    const photo = attachment('board', { ticketId: null });
    const detail = makeChatDetail();
    const sent = makeMessage({ id: 'm-3', text: 'Turn this into tickets', attachments: [photo] });
    setup({ ...detail, messages: [...detail.messages, sent] });
    const messages = await screen.findByRole('list', { name: 'Messages' });
    const mine = within(messages).getAllByRole('article', { name: 'You' }).at(-1)!;
    expect(mine).toHaveTextContent('Turn this into tickets');
    const user = userEvent.setup();
    await user.click(within(mine).getByRole('button', { name: 'Open image 1' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it("says which photo Claude won't get, before Send and on the sent message", async () => {
    const heic = attachment('h', {
      ticketId: null,
      fileName: 'IMG_1.heic',
      mimeType: 'image/heic',
    });
    const note = "Claude won't get IMG_1.heic: the tracker can't remove its location.";
    const detail = makeChatDetail();
    const sent = makeMessage({ id: 'm-3', text: 'Look', attachments: [heic] });
    setup(
      { ...detail, messages: [...detail.messages, sent] },
      {
        uploadAttachment: vi.fn().mockResolvedValue(heic),
      },
    );
    const messages = await screen.findByRole('list', { name: 'Messages' });
    const mine = within(messages).getAllByRole('article', { name: 'You' }).at(-1)!;
    expect(mine).toHaveTextContent(note);
    // A Mac sends a dropped HEIC; the picker's list leaves HEIC out for iPhones (§1.4).
    const user = userEvent.setup({ applyAccept: false });
    const photo = new File(['heic'], 'IMG_1.heic', { type: 'image/heic' });
    await user.upload(screen.getByLabelText('Attach files to question'), photo);
    expect(await screen.findAllByText(note)).toHaveLength(2);
  });
});

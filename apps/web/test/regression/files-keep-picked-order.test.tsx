import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Attachment } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred, type Deferred } from '../../src/api/test/deferred';
import { attachment, listItem, STATUS } from '../../src/api/test/fixtures';
import { skipAnimations } from '../../src/overlays/testing';
import {
  CAPTURE,
  COMMENT_BOX,
  NEW_TICKET,
  type ShownSurface,
  type Surface,
} from './attachmentSurfaces';

const NAMES = ['a.txt', 'b.txt', 'c.txt'];

const picked = () => NAMES.map((name) => new File([name], name, { type: 'text/plain' }));

const uploaded = (name: string): Attachment =>
  attachment(name.replace('.txt', ''), { ticketId: null, fileName: name, mimeType: 'text/plain' });

let shown: ShownSurface | undefined;
let undoAnimations: () => void;

beforeEach(() => {
  undoAnimations = skipAnimations();
});

afterEach(() => {
  shown?.restore();
  undoAnimations();
  localStorage.clear();
});

const tileNames = () =>
  within(shown!.area())
    .getAllByTitle(/^[abc]\.txt$/)
    .map((tile) => tile.getAttribute('title'));

// One answer per upload, in the order the files were picked, settled by the test.
function slowUploads(surface: Surface, overrides: Parameters<Surface['show']>[0] = {}) {
  const answers: Deferred<Attachment>[] = [];
  shown = surface.show({
    uploadAttachment: vi.fn(() => {
      const answer = deferred<Attachment>();
      answers.push(answer);
      return answer.promise;
    }),
    ...overrides,
  });
  return answers;
}

async function pickAndFinishBackwards(answers: Deferred<Attachment>[]) {
  await userEvent.setup().upload(shown!.input(), picked());
  await waitFor(() => expect(answers).toHaveLength(3));
  expect(tileNames()).toEqual(NAMES);
  for (const index of [2, 0, 1]) {
    answers[index]!.resolve(uploaded(NAMES[index]!));
    await waitFor(() => expect(tileNames()).toEqual(NAMES));
  }
  await waitFor(() => expect(within(shown!.area()).queryByRole('progressbar')).toBeNull());
  expect(tileNames()).toEqual(NAMES);
}

// Files upload side by side and a tile became a saved file when its upload finished, so a small
// file picked last jumped ahead of the larger ones, and the ticket or comment got them in the
// order they finished.
describe.each([NEW_TICKET, CAPTURE, COMMENT_BOX])('files picked in $name', (surface) => {
  it('keep the order they were picked while they upload and once they are up', async () => {
    await pickAndFinishBackwards(slowUploads(surface));
  });
});

it('a new ticket is created with its files in the order they were picked', async () => {
  const { commentCount: _c, attachmentCount: _a, ...created } = listItem(5, STATUS.todo, -1000);
  const createTicket = vi.fn().mockResolvedValue(created);
  await pickAndFinishBackwards(slowUploads(NEW_TICKET, { createTicket }));
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Ticket title'), 'Crash on rotate');
  await user.click(within(shown!.area()).getByRole('button', { name: 'Create' }));
  expect(createTicket).toHaveBeenCalledWith(
    'MOB',
    expect.objectContaining({ attachmentIds: ['a', 'b', 'c'] }),
  );
});

it('a comment is sent with its files in the order they were picked', async () => {
  const addComment = vi.fn().mockReturnValue(new Promise(() => undefined));
  await pickAndFinishBackwards(slowUploads(COMMENT_BOX, { addComment }));
  await userEvent.setup().click(screen.getByRole('button', { name: 'Comment' }));
  expect(addComment).toHaveBeenCalledWith('MOB-1', { text: '', attachmentIds: ['a', 'b', 'c'] });
});

it('a file picked later that is removed while it waits is deleted and the rest still go', async () => {
  const deleteAttachment = vi.fn().mockResolvedValue(undefined);
  const answers = slowUploads(NEW_TICKET, { deleteAttachment });
  await userEvent.setup().upload(shown!.input(), picked());
  await waitFor(() => expect(answers).toHaveLength(3));
  answers[1]!.resolve(uploaded('b.txt'));
  await userEvent
    .setup()
    .click(within(shown!.area()).getByRole('button', { name: 'Remove b.txt' }));
  await waitFor(() => expect(deleteAttachment).toHaveBeenCalledWith('b'));
  answers[0]!.resolve(uploaded('a.txt'));
  answers[2]!.resolve(uploaded('c.txt'));
  await waitFor(() => expect(within(shown!.area()).queryByRole('progressbar')).toBeNull());
  expect(tileNames()).toEqual(['a.txt', 'c.txt']);
});

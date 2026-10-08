import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachment } from '../../src/api/test/fixtures';
import { CLICK_SHIELD_MS } from '../../src/lib/clickShield';
import { skipAnimations } from '../../src/overlays/testing';
import {
  CAPTURE,
  COMMENT_BOX,
  NEW_TICKET,
  TICKET_SCREEN,
  type ShownSurface,
  type Surface,
} from './attachmentSurfaces';
import { doubleClick, GAPS } from './doubleClick';

const NAMES = ['a.txt', 'b.txt', 'c.txt', 'd.txt'];

const picked = () => [
  ...NAMES.map((name) => new File([name], name, { type: 'text/plain' })),
  new File(['<svg/>'], 'notes.svg', { type: 'image/svg+xml' }),
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

const area = () => within(shown!.area());

const addComment = vi.fn(() => new Promise(() => undefined));

async function pickWithRefusal(surface: Surface) {
  addComment.mockClear();
  shown = surface.show({
    addComment,
    uploadAttachment: vi.fn((_file: Blob, fileName: string) =>
      Promise.resolve(attachment(fileName, { fileName, mimeType: 'text/plain' })),
    ),
  });
  const user = userEvent.setup({ applyAccept: false });
  await user.upload(shown.input(), picked());
  await waitFor(() => expect(area().queryByRole('progressbar')).toBeNull());
  expect(area().getByRole('alert')).toHaveTextContent("notes.svg can't be attached.");
  return user;
}

const dismiss = () => within(area().getByRole('alert')).getByRole('button', { name: 'Dismiss' });

// What took the Dismiss button's place once the note went: the tiles move up and the 4th file's x
// is under the finger; in the comment box Comment comes up from below.
const UNDER = new Map<Surface, () => HTMLElement>([
  [NEW_TICKET, () => area().getByRole('button', { name: 'Remove d.txt' })],
  [CAPTURE, () => area().getByRole('button', { name: 'Remove d.txt' })],
  [TICKET_SCREEN, () => area().getByRole('button', { name: 'Remove d.txt' })],
  [COMMENT_BOX, () => area().getByRole('button', { name: 'Comment' })],
]);

// WebKit at 320×568: a double tap on the note's Dismiss removed a draft file (New ticket, quick
// capture), asked to remove a file (the ticket screen) or sent the comment (the comment box), as
// what lay under the note slid under the finger for the second tap. jsdom has no layout, so the
// second tap goes to what the browser finds there: the note while it keeps its place, else what
// slid up.
describe.each([NEW_TICKET, CAPTURE, TICKET_SCREEN, COMMENT_BOX])('the note in $name', (surface) => {
  it.each(GAPS)('takes a double tap on Dismiss as one (%i ms apart)', async (gap) => {
    const user = await pickWithRefusal(surface);
    const under = UNDER.get(surface)!();
    await doubleClick(user, dismiss(), under, gap);

    await wait(CLICK_SHIELD_MS);
    expect(area().queryByRole('alert')).not.toBeInTheDocument();
    expect(area().getAllByTitle(/^[a-d]\.txt$/)).toHaveLength(4);
    expect(screen.queryByRole('dialog', { name: /^Remove/ })).not.toBeInTheDocument();
    expect(addComment).not.toHaveBeenCalled();
  });

  it('goes from the keyboard at once', async () => {
    const user = await pickWithRefusal(surface);
    dismiss().focus();
    await user.keyboard('{Enter}');
    expect(area().queryByRole('alert')).not.toBeInTheDocument();
  });

  it('stays for the next pick that leaves a file out, even while the last one goes', async () => {
    const user = await pickWithRefusal(surface);
    await user.click(dismiss());
    await user.upload(shown!.input(), new File(['zip'], 'logs.zip', { type: 'application/zip' }));
    await wait(CLICK_SHIELD_MS);
    expect(area().getByRole('alert')).toHaveTextContent("logs.zip can't be attached.");
  });
});

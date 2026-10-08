import { waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import type { Attachment } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred } from '../../src/api/test/deferred';
import { attachment } from '../../src/api/test/fixtures';
import { skipAnimations } from '../../src/overlays/testing';
import {
  CAPTURE,
  COMMENT_BOX,
  NEW_TICKET,
  TICKET_SCREEN,
  type ShownSurface,
  type Surface,
} from './attachmentSurfaces';

const text = (name: string) => new File([name], name, { type: 'text/plain' });
const svg = () => new File(['<svg/>'], 'notes.svg', { type: 'image/svg+xml' });

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

// Where files are added on each surface: the note answers a pick.
const ADD = new Map<Surface, string>([
  [NEW_TICKET, 'Add files'],
  [CAPTURE, 'Add files'],
  [TICKET_SCREEN, 'Add files'],
  [COMMENT_BOX, 'Attach files'],
]);

// late.txt's upload fails when the test says; the others go up at once.
function showWithLateFailure(surface: Surface) {
  const late = deferred<Attachment>();
  shown = surface.show({
    uploadAttachment: vi.fn((_file: Blob, fileName: string) =>
      fileName === 'late.txt'
        ? late.promise
        : Promise.resolve(attachment(fileName, { fileName, mimeType: 'text/plain' })),
    ),
  });
  return () => late.reject(new ApiError(408, 'http_error', 'Request Timeout'));
}

const noteSaying = (words: string) =>
  area()
    .getAllByRole('alert')
    .find((note) => note.textContent?.includes(words))!;

async function dismissByKey(user: ReturnType<typeof userEvent.setup>, note: HTMLElement) {
  within(note).getByRole('button', { name: 'Dismiss' }).focus();
  await user.keyboard('{Enter}');
}

// A key press on a file note's Dismiss took the note away with the focus in it, which fell to the
// page body (PT-95): a keyboard or switch user started over from the top of the page.
describe.each([NEW_TICKET, CAPTURE, TICKET_SCREEN, COMMENT_BOX])(
  'Dismiss from the keyboard in $name',
  (surface) => {
    it("hands focus to where files are added, from a pick's note", async () => {
      showWithLateFailure(surface);
      const user = userEvent.setup({ applyAccept: false });
      await user.upload(shown!.input(), [text('a.txt'), svg()]);
      await waitFor(() => expect(area().queryByRole('progressbar')).toBeNull());

      await dismissByKey(user, noteSaying("can't be attached"));
      expect(area().queryByRole('alert')).not.toBeInTheDocument();
      expect(area().getByRole('button', { name: ADD.get(surface) })).toHaveFocus();
    });

    it('hands focus to where files are added, from a late failure', async () => {
      const fail = showWithLateFailure(surface);
      const user = userEvent.setup();
      await user.upload(shown!.input(), [text('a.txt'), text('late.txt')]);
      fail();
      await waitFor(() => expect(noteSaying("didn't upload")).toBeDefined());

      await dismissByKey(user, noteSaying("didn't upload"));
      expect(area().queryByRole('alert')).not.toBeInTheDocument();
      expect(area().getByRole('button', { name: ADD.get(surface) })).toHaveFocus();
    });
  },
);

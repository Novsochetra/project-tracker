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

const follows = (first: Element, second: Element) =>
  (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

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

const failedNote = () =>
  area()
    .getAllByRole('alert')
    .find((note) => note.textContent?.includes("didn't upload"));

// WebKit at 320×568, scrolled down to the Add tile under 16 files: an upload that failed seconds
// later put its note above the files, so every tile on screen moved down 53–70px and in New ticket
// the note itself landed under the sheet's header, unseen. Safari keeps no scroll anchor, so a late
// note goes below the files: what is on screen stays put, and the note shows where the person is.
describe.each([NEW_TICKET, CAPTURE, TICKET_SCREEN])('a late failure in $name', (surface) => {
  it('is said below the files and the Add tile', async () => {
    const fail = showWithLateFailure(surface);
    await userEvent.setup().upload(shown!.input(), [text('a.txt'), text('late.txt')]);
    await waitFor(() => expect(area().getAllByTitle(/\.txt$/)).toHaveLength(2));
    fail();

    await waitFor(() => expect(failedNote()).toBeDefined());
    const note = failedNote()!;
    expect(note).toHaveTextContent("late.txt didn't upload.");
    expect(follows(area().getByTitle('a.txt'), note)).toBe(true);
    expect(follows(area().getByRole('button', { name: 'Add files' }), note)).toBe(true);
  });

  it("leaves the pick's note above the files, where it was", async () => {
    const fail = showWithLateFailure(surface);
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(shown!.input(), [text('a.txt'), text('late.txt'), svg()]);
    const refusal = area().getByRole('alert');
    expect(refusal).toHaveTextContent("notes.svg can't be attached.");
    fail();

    await waitFor(() => expect(failedNote()).toBeDefined());
    expect(refusal).toBeInTheDocument();
    expect(refusal).toHaveTextContent("notes.svg can't be attached.");
    expect(follows(refusal, area().getByTitle('a.txt'))).toBe(true);
  });
});

import { screen, waitFor, within } from '@testing-library/react';
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
  Reflect.deleteProperty(document, 'elementFromPoint');
});

const area = () => within(shown!.area());

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

const failedTile = () => area().queryByRole('img', { name: "late.txt didn't upload" });
const failedNote = () =>
  area()
    .queryAllByRole('alert')
    .find((note) => note.textContent?.includes("didn't upload"));

async function failLate(surface: Surface) {
  const fail = showWithLateFailure(surface);
  const user = userEvent.setup({ applyAccept: false });
  await user.upload(shown!.input(), [text('a.txt'), text('late.txt')]);
  await waitFor(() => expect(area().getByTitle('a.txt')).toBeInTheDocument());
  fail();
  await waitFor(() => expect(failedTile()).toBeInTheDocument());
  return user;
}

// WebKit at 320×568, scrolled to the middle of 16 files: an upload that failed late took its tile
// away, the Add tile slid into its place, and the note saying why landed below the screen, so
// nothing in view said a file was lost (PT-95). The tile stays where it was and says so, until
// its x or the note's Dismiss lets it go, or the next pick replaces the note.
describe.each([NEW_TICKET, CAPTURE, TICKET_SCREEN])('a late failure in $name', (surface) => {
  it("keeps the file's tile, saying it didn't upload", async () => {
    await failLate(surface);
    expect(failedNote()).toHaveTextContent("late.txt didn't upload.");
    expect(area().getByTitle('late.txt')).toBeInTheDocument();
    expect(area().queryByRole('progressbar')).not.toBeInTheDocument();
    expect(area().getByRole('button', { name: 'Remove late.txt' })).toBeInTheDocument();
  });

  it('lets the tile go with its x, and leaves the note', async () => {
    const user = await failLate(surface);
    await user.click(area().getByRole('button', { name: 'Remove late.txt' }));
    expect(failedTile()).not.toBeInTheDocument();
    expect(area().queryByTitle('late.txt')).not.toBeInTheDocument();
    expect(failedNote()).toBeDefined();
  });

  it("lets the tile go with the note's Dismiss", async () => {
    const user = await failLate(surface);
    within(failedNote()!).getByRole('button', { name: 'Dismiss' }).focus();
    await user.keyboard('{Enter}');
    expect(failedTile()).not.toBeInTheDocument();
    expect(area().getByTitle('a.txt')).toBeInTheDocument();
  });

  it('lets the tile go with the next pick', async () => {
    const user = await failLate(surface);
    await user.upload(shown!.input(), svg());
    expect(failedTile()).not.toBeInTheDocument();
    expect(failedNote()).toBeUndefined();
  });
});

describe('a late failure in New ticket', () => {
  it('holds Create no longer than the uploads still going', async () => {
    const user = await failLate(NEW_TICKET);
    await user.type(area().getByLabelText('Ticket title'), 'Crash logs');
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });
});

// What the browser finds at the middle of the note: jsdom has no layout.
const showing = (found: () => Element) => {
  document.elementFromPoint = () => found();
};
const said = () => screen.queryAllByText("late.txt didn't upload.");

// The same at 320×568: from the middle of 16 files, or from the Add tile at the bottom of the
// screen, the note that says why landed out of sight, and on the ticket screen the tile too (PT-95).
describe.each([NEW_TICKET, CAPTURE, TICKET_SCREEN])(
  'a late failure with its note out of sight in $name',
  (surface) => {
    it('is said in a toast too', async () => {
      showing(() => document.body);
      await failLate(surface);
      await waitFor(() => expect(said()).toHaveLength(2));
      expect(said().filter((text) => !shown!.area().contains(text))).toHaveLength(1);
    });

    it('is said only in the file area while its note is in sight', async () => {
      showing(() => failedNote()!);
      await failLate(surface);
      expect(said()).toHaveLength(1);
    });
  },
);

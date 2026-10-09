import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import type { Attachment } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred } from '../../src/api/test/deferred';
import { attachment } from '../../src/api/test/fixtures';
import { skipAnimations } from '../../src/overlays/testing';
import { COMMENT_BOX, type ShownSurface } from './attachmentSurfaces';

// The comment box keeps no failed tile, and its note sits below the files by Attach files. From
// the top of many files at 320×568 that note is out of sight, so an upload that failed late went
// unseen; the file pickers say it in a toast too (PT-95, PT-101).

const text = (name: string) => new File([name], name, { type: 'text/plain' });

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
const failedNote = () =>
  area()
    .queryAllByRole('alert')
    .find((note) => note.textContent?.includes("didn't upload"));
const said = () => screen.queryAllByText("late.txt didn't upload.");

// What the browser finds at the middle of the note: jsdom has no layout.
const showing = (found: () => Element) => {
  document.elementFromPoint = () => found();
};

async function failLate() {
  const late = deferred<Attachment>();
  shown = COMMENT_BOX.show({
    uploadAttachment: vi.fn((_file: Blob, fileName: string) =>
      fileName === 'late.txt'
        ? late.promise
        : Promise.resolve(attachment(fileName, { fileName, mimeType: 'text/plain' })),
    ),
  });
  const user = userEvent.setup({ applyAccept: false });
  await user.upload(shown.input(), [text('a.txt'), text('late.txt')]);
  await waitFor(() => expect(area().getByTitle('a.txt')).toBeInTheDocument());
  late.reject(new ApiError(408, 'http_error', 'Request Timeout'));
  await waitFor(() => expect(failedNote()).toBeDefined());
}

describe('regression: a late upload failure in the comment box', () => {
  it('is said in a toast too while its note is out of sight', async () => {
    showing(() => document.body);
    await failLate();
    await waitFor(() => expect(said()).toHaveLength(2));
    expect(said().filter((note) => !shown!.area().contains(note))).toHaveLength(1);
  });

  it('is said only by the comment box while its note is in sight', async () => {
    showing(() => failedNote()!);
    await failLate();
    expect(said()).toHaveLength(1);
  });
});

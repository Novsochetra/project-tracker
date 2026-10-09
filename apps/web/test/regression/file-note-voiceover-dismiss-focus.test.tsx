import { fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import type { Attachment } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred } from '../../src/api/test/deferred';
import { attachment } from '../../src/api/test/fixtures';
import { skipAnimations, tap } from '../../src/overlays/testing';
import {
  CAPTURE,
  COMMENT_BOX,
  NEW_TICKET,
  TICKET_SCREEN,
  type ShownSurface,
  type Surface,
} from './attachmentSurfaces';

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
});

const area = () => within(shown!.area());

const ADD = new Map<Surface, string>([
  [NEW_TICKET, 'Add files'],
  [CAPTURE, 'Add files'],
  [TICKET_SCREEN, 'Add files'],
  [COMMENT_BOX, 'Attach files'],
]);

async function failLate(surface: Surface, names: string[]) {
  const late = deferred<Attachment>();
  shown = surface.show({
    uploadAttachment: vi.fn((_file: Blob, fileName: string) =>
      fileName === 'late.txt'
        ? late.promise
        : Promise.resolve(attachment(fileName, { fileName, mimeType: 'text/plain' })),
    ),
  });
  const user = userEvent.setup();
  await user.upload(shown.input(), names.map(text));
  late.reject(new ApiError(408, 'http_error', 'Request Timeout'));
  const dismiss = await waitFor(() => within(area().getByRole('alert')).getByRole('button'));
  return { user, dismiss };
}

// VoiceOver activates the control it is on with a click and no pointer before it (detail 1 on
// iOS). Since PT-95 only a key press moved focus on from the Dismiss it took away with the note, so
// VoiceOver started over from the top of the page (PT-101).
describe.each([NEW_TICKET, CAPTURE, TICKET_SCREEN, COMMENT_BOX])(
  "VoiceOver's Dismiss in $name",
  (surface) => {
    it('hands focus to where files are added', async () => {
      const { dismiss } = await failLate(surface, ['a.txt', 'late.txt']);

      fireEvent.click(dismiss, { detail: 1 });

      expect(area().queryByRole('alert')).not.toBeInTheDocument();
      expect(area().getByRole('button', { name: ADD.get(surface) })).toHaveFocus();
    });
  },
);

describe.each([NEW_TICKET, CAPTURE, TICKET_SCREEN])(
  "VoiceOver's Dismiss of the only file failing in $name",
  (surface) => {
    it('hands focus to Add files', async () => {
      const { dismiss } = await failLate(surface, ['late.txt']);

      fireEvent.click(dismiss, { detail: 1 });

      expect(area().getByRole('button', { name: 'Add files' })).toHaveFocus();
    });
  },
);

// A finger's tap moves nothing it didn't touch: focus stays out of the way of the next tap.
describe('a tap on Dismiss', () => {
  it('leaves focus where the tap put it', async () => {
    const { user, dismiss } = await failLate(NEW_TICKET, ['a.txt', 'late.txt']);

    await tap(user, dismiss);

    expect(area().queryByRole('alert')).not.toBeInTheDocument();
    expect(area().getByRole('button', { name: 'Add files' })).not.toHaveFocus();
  });
});

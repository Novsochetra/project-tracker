import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachment } from '../../src/api/test/fixtures';
import { CLICK_SHIELD_MS } from '../../src/lib/clickShield';
import { skipAnimations, tap } from '../../src/overlays/testing';
import {
  CAPTURE,
  NEW_TICKET,
  TICKET_SCREEN,
  type ShownSurface,
  type Surface,
} from './attachmentSurfaces';

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

async function pickWithRefusal(surface: Surface) {
  shown = surface.show({
    uploadAttachment: vi.fn((_file: Blob, fileName: string) =>
      Promise.resolve(attachment(fileName, { fileName, mimeType: 'text/plain' })),
    ),
  });
  const user = userEvent.setup({ applyAccept: false });
  await user.upload(shown.input(), picked());
  await waitFor(() => expect(area().queryByRole('progressbar')).toBeNull());
  return user;
}

const dismiss = () => within(area().getByRole('alert')).getByRole('button', { name: 'Dismiss' });
const firstX = () => area().getByRole('button', { name: 'Remove a.txt' });
const asked = () => screen.queryByRole('dialog', { name: /^Remove/ });
const removed = () => area().queryAllByTitle(/^[a-d]\.txt$/).length < NAMES.length || asked();

// WebKit at 375×812 on the ticket screen: a tap on Dismiss hid the note but kept its place for
// 500 ms, then the files under it jumped up 110px at once, so a tap aimed at image 1's x in that
// time landed on image 5's (PT-95). The place goes with the tap now, and for CLICK_SHIELD_MS what
// moved into it takes no taps; after that a tap acts on what the person sees there.
describe.each([NEW_TICKET, CAPTURE, TICKET_SCREEN])('a tap on Dismiss in $name', (surface) => {
  it('takes the note and its place at once, and holds back taps only for a moment', async () => {
    const user = await pickWithRefusal(surface);
    await tap(user, dismiss());
    expect(area().queryByRole('alert')).not.toBeInTheDocument();

    await tap(user, firstX());
    expect(removed()).toBeFalsy();
    await wait(CLICK_SHIELD_MS);
    await tap(user, firstX());
    expect(removed()).toBeTruthy();
  });
});

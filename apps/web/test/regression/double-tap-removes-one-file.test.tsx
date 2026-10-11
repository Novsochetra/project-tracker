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
  type ShownSurface,
  type Surface,
} from './attachmentSurfaces';
import { GAPS } from './doubleClick';
import { advance, stillClock } from './stillClock';

const NAMES = ['a.txt', 'b.txt', 'c.txt'];

const picked = () => NAMES.map((name) => new File([name], name, { type: 'text/plain' }));

let shown: ShownSurface | undefined;
let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.reverse().forEach((undo) => undo());
  shown?.restore();
  localStorage.clear();
});

const tileNames = () =>
  within(shown!.area())
    .queryAllByTitle(/^[abc]\.txt$/)
    .map((tile) => tile.getAttribute('title'));

const removeButton = (name: string) =>
  within(shown!.area()).getByRole('button', { name: `Remove ${name}` });

async function pickThree(surface: Surface, phone = true) {
  const uploadAttachment = vi.fn((_file: Blob, fileName: string) =>
    Promise.resolve(
      attachment(fileName.replace('.txt', ''), {
        ticketId: null,
        fileName,
        mimeType: 'text/plain',
      }),
    ),
  );
  shown = surface.show({ uploadAttachment }, phone);
  const user = userEvent.setup();
  await user.upload(shown.input(), picked());
  await waitFor(() => expect(within(shown!.area()).queryByRole('progressbar')).toBeNull());
  expect(tileNames()).toEqual(NAMES);
  restore.push(stillClock());
  return user;
}

// On phones a double tap on a draft file's x removed two files (WebKit, iPhone 13): the next
// thumbnail slid into the removed one's place, and its x took the second tap 0–200 ms later. jsdom
// has no layout, so each test taps the x the browser found there: the next file's.
describe.each([NEW_TICKET, CAPTURE, COMMENT_BOX])('the x of a file in $name', (surface) => {
  it.each(GAPS)('removes one file on a double tap (%i ms apart)', async (gap) => {
    const user = await pickThree(surface);
    await user.click(removeButton('a.txt'));
    if (gap > 0) await advance(gap);
    await user.click(removeButton('b.txt'));
    expect(tileNames()).toEqual(['b.txt', 'c.txt']);
  });

  it('removes the next file on a tap once the double tap is over', async () => {
    const user = await pickThree(surface);
    await user.click(removeButton('a.txt'));
    await advance(CLICK_SHIELD_MS);
    await user.click(removeButton('b.txt'));
    expect(tileNames()).toEqual(['c.txt']);
  });

  it('removes the next file from the keyboard at once', async () => {
    const user = await pickThree(surface);
    await user.click(removeButton('a.txt'));
    removeButton('b.txt').focus();
    await user.keyboard('{Enter}');
    expect(tileNames()).toEqual(['c.txt']);
  });

  // A touch tablet is as wide as a desktop and lost two files the same way, and so did a mouse's
  // double-click (PT-72 review): the shield goes by the press, not the screen.
  it.each(GAPS)(
    'removes one file on a double-click on a wide screen (%i ms apart)',
    async (gap) => {
      const user = await pickThree(surface, false);
      await user.click(removeButton('a.txt'));
      if (gap > 0) await advance(gap);
      await user.click(removeButton('b.txt'));
      expect(tileNames()).toEqual(['b.txt', 'c.txt']);
    },
  );
});

it('keeps removing on a phone after the shield, as often as the person taps', async () => {
  const user = await pickThree(NEW_TICKET);
  await user.click(removeButton('a.txt'));
  await advance(CLICK_SHIELD_MS);
  await user.click(removeButton('b.txt'));
  await advance(CLICK_SHIELD_MS);
  await user.click(removeButton('c.txt'));
  expect(tileNames()).toEqual([]);
  expect(screen.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument();
});

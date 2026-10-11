import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CLICK_SHIELD_MS } from '../../src/lib/clickShield';
import { Sheet, SheetTextButton } from '../../src/overlays';
import { mockPhone, skipAnimations, tap } from '../../src/overlays/testing';
import { advance, stillClock } from './stillClock';

// PT-148: a closing sheet takes no taps, so the second tap of a double tap on its Close, Cancel or
// a primary action that closes it landed on the screen under it: the nav bar's Back, or a text
// field, which opened the keyboard. PT-141 held the screen for Run only.

function Screen({ onBehind, onInside }: { onBehind: () => void; onInside: () => void }) {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState('');
  return (
    <>
      <button type="button" onClick={onBehind}>
        Behind
      </button>
      <input aria-label="Comment" />
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        label="Send to Claude Code"
        title="Send to Claude Code"
        left={<SheetTextButton onClick={() => setOpen(false)}>Close</SheetTextButton>}
        dirty={text !== ''}
      >
        <input
          aria-label="Prompt"
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
        />
        <button type="button" onClick={onInside}>
          Inside
        </button>
      </Sheet>
    </>
  );
}

let cleanups: Array<() => void> = [];

beforeEach(() => {
  cleanups = [skipAnimations()];
});

afterEach(() => cleanups.reverse().forEach((undo) => undo()));

function renderScreen(phone: boolean) {
  cleanups.push(mockPhone(phone));
  const onBehind = vi.fn();
  const onInside = vi.fn();
  render(<Screen onBehind={onBehind} onInside={onInside} />);
  cleanups.push(stillClock());
  return { onBehind, onInside, user: userEvent.setup() };
}

const sheet = () => screen.queryByRole('dialog', { name: 'Send to Claude Code' });
const close = () => within(sheet()!).getByRole('button', { name: 'Close' });
const scrim = () =>
  within(sheet()!.parentElement!)
    .getAllByRole('button', { name: 'Close' })
    .find((button) => !sheet()!.contains(button))!;
const behind = () => screen.getByRole('button', { name: 'Behind' });
const comment = () => screen.getByRole('textbox', { name: 'Comment' });

it("drops a phone's second tap on the screen the sheet's Close uncovers", async () => {
  const { onBehind, user } = renderScreen(true);
  await tap(user, close());
  await tap(user, behind());
  await tap(user, comment());
  expect(onBehind).not.toHaveBeenCalled();
  expect(comment()).not.toHaveFocus();

  await advance(CLICK_SHIELD_MS);
  await tap(user, behind());
  expect(onBehind).toHaveBeenCalledTimes(1);
});

it('drops the second tap of a double tap on the scrim', async () => {
  const { onBehind, user } = renderScreen(true);
  await tap(user, scrim());
  await tap(user, behind());
  expect(onBehind).not.toHaveBeenCalled();
});

it('drops the second tap after Discard changes closes the sheet', async () => {
  const { onBehind, user } = renderScreen(true);
  await user.type(screen.getByRole('textbox', { name: 'Prompt' }), 'Half a prompt');
  await tap(user, scrim());
  await advance(CLICK_SHIELD_MS);
  await tap(user, screen.getByRole('button', { name: 'Discard changes' }));
  await tap(user, behind());
  expect(onBehind).not.toHaveBeenCalled();
});

// The sheet under it stays open, so what lies under Keep editing is the sheet's, as the person left it.
it('lets the next tap in the sheet through after Keep editing', async () => {
  const { onInside, user } = renderScreen(true);
  await user.type(screen.getByRole('textbox', { name: 'Prompt' }), 'Half a prompt');
  await tap(user, scrim());
  await advance(CLICK_SHIELD_MS);
  await tap(user, screen.getByRole('button', { name: 'Keep editing' }));
  await tap(user, within(sheet()!).getByRole('button', { name: 'Inside' }));
  expect(onInside).toHaveBeenCalledTimes(1);
});

it("drops a double-click's second click on desktop and lets a single click through", async () => {
  const { onBehind, user } = renderScreen(false);
  await user.click(close());
  expect(fireEvent.mouseDown(comment(), { detail: 2 })).toBe(false);
  fireEvent.click(behind(), { detail: 2 });
  expect(onBehind).not.toHaveBeenCalled();

  await user.click(behind());
  expect(onBehind).toHaveBeenCalledTimes(1);
});

const touch = { pointerId: 5, pointerType: 'touch', isPrimary: true, button: 0, clientX: 120 };

function swipeDown(target: Element) {
  fireEvent.pointerDown(target, { ...touch, clientY: 100 });
  fireEvent.pointerMove(target, { ...touch, clientY: 300 });
  fireEvent.pointerMove(target, { ...touch, clientY: 500 });
  fireEvent.pointerUp(target, { ...touch, clientY: 500 });
}

// Escape and a swipe-down are no click, so no second tap follows them: the next tap is aimed.
it('lets the next tap through after Escape closes the sheet', async () => {
  const { onBehind, user } = renderScreen(true);
  await tap(user, screen.getByRole('textbox', { name: 'Prompt' }));
  await user.keyboard('{Escape}');
  expect(sheet()).toBeNull();
  await tap(user, behind());
  expect(onBehind).toHaveBeenCalledTimes(1);
});

it('lets the next tap through after a swipe-down closes the sheet', async () => {
  const { onBehind, user } = renderScreen(true);
  await tap(user, screen.getByRole('textbox', { name: 'Prompt' }));
  swipeDown(within(sheet()!).getByText('Send to Claude Code'));
  await advance(0);
  expect(sheet()).toBeNull();
  await tap(user, behind());
  expect(onBehind).toHaveBeenCalledTimes(1);
});

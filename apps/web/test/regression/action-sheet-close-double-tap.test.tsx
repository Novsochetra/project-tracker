import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CLICK_SHIELD_MS } from '../../src/lib/clickShield';
import { ActionSheet } from '../../src/overlays';
import { mockPhone, skipAnimations, tap } from '../../src/overlays/testing';
import { advance, stillClock } from './stillClock';

// PT-148: like a sheet, a closing action sheet takes no taps, so the second tap of a double tap on
// its Cancel, or on a row that closes it (a row swipe's Status, Comment or Project options), landed
// on the screen it uncovered.

function Screen({ onBehind }: { onBehind: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={onBehind}>
        Behind
      </button>
      <ActionSheet
        open={open}
        onClose={() => setOpen(false)}
        label="Comment options"
        actions={[
          { label: 'Copy text', onSelect: () => setOpen(false) },
          { label: 'Edit', onSelect: () => undefined },
        ]}
      />
    </>
  );
}

let cleanups: Array<() => void> = [];

beforeEach(() => {
  cleanups = [skipAnimations(), mockPhone(true)];
});

afterEach(() => cleanups.reverse().forEach((undo) => undo()));

async function renderScreen() {
  const onBehind = vi.fn();
  render(<Screen onBehind={onBehind} />);
  cleanups.push(stillClock());
  // Its rows take taps once a person could have read them (PT-80).
  await advance(CLICK_SHIELD_MS);
  return { onBehind, user: userEvent.setup() };
}

const sheet = () => screen.queryByRole('dialog', { name: 'Comment options' });
const behind = () => screen.getByRole('button', { name: 'Behind' });
const scrim = () =>
  within(sheet()!.parentElement!)
    .getAllByRole('button', { name: 'Close' })
    .find((button) => !sheet()!.contains(button))!;

it("drops a phone's second tap on the screen the action sheet's Cancel uncovers", async () => {
  const { onBehind, user } = await renderScreen();
  await tap(user, within(sheet()!).getByRole('button', { name: 'Cancel' }));
  await tap(user, behind());
  expect(onBehind).not.toHaveBeenCalled();

  await advance(CLICK_SHIELD_MS);
  await tap(user, behind());
  expect(onBehind).toHaveBeenCalledTimes(1);
});

it('drops the second tap after a row closes the action sheet', async () => {
  const { onBehind, user } = await renderScreen();
  await tap(user, within(sheet()!).getByRole('button', { name: 'Copy text' }));
  expect(sheet()).toBeNull();
  await tap(user, behind());
  expect(onBehind).not.toHaveBeenCalled();
});

it('drops the second tap of a double tap on the scrim', async () => {
  const { onBehind, user } = await renderScreen();
  await tap(user, scrim());
  await tap(user, behind());
  expect(onBehind).not.toHaveBeenCalled();
});

it('lets the next tap through after Escape closes the action sheet', async () => {
  const { onBehind, user } = await renderScreen();
  await tap(user, within(sheet()!).getByRole('button', { name: 'Edit' }));
  await user.keyboard('{Escape}');
  expect(sheet()).toBeNull();
  await tap(user, behind());
  expect(onBehind).toHaveBeenCalledTimes(1);
});

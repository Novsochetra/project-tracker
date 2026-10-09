import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { holdPresses } from '../../src/lib/holdPresses';
import { DiscardChangesSheet } from '../../src/overlays/DiscardChangesSheet';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';
import { TICKET_SCREEN, type ShownSurface } from './attachmentSurfaces';

// PT-130: PT-115 kept only the primary button's presses, but a Mac's ctrl+click is the primary
// button's too. It opens a context menu, and Chromium sends no click for it, so it stayed until the
// next click on that element: VoiceOver's click then passed for a mouse's single click.

let restore: Array<() => void> = [];
let shown: ShownSurface | undefined;

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  shown?.restore();
  shown = undefined;
  restore.reverse().forEach((undo) => undo());
  localStorage.clear();
});

// What Chromium on a Mac sends for a ctrl+click: the primary button, a context menu, no click.
function ctrlClick(target: Element) {
  const press = { button: 0, ctrlKey: true };
  fireEvent.pointerDown(target, { ...press, pointerType: 'mouse', buttons: 1 });
  fireEvent.mouseDown(target, { ...press, buttons: 1, detail: 1 });
  fireEvent.contextMenu(target, press);
  fireEvent.pointerUp(target, { ...press, pointerType: 'mouse' });
  fireEvent.mouseUp(target, { ...press, detail: 1 });
}

// VoiceOver's click: no pointer before it. False when a shield dropped it.
const voiceOverClick = (target: Element): boolean => fireEvent.click(target, { detail: 1 });

describe('regression: a Mac ctrl+click is no press for the next click', () => {
  it('Discard changes holds a click with no pointer after a ctrl+click on its row', () => {
    restore.push(mockPhone(false));
    const onDiscard = vi.fn();
    render(<DiscardChangesSheet open onKeep={vi.fn()} onDiscard={onDiscard} />);
    const row = screen.getByRole('button', { name: 'Discard changes' });

    ctrlClick(row);
    voiceOverClick(row);

    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("Dismiss moves focus on VoiceOver's click after a ctrl+click on it", async () => {
    shown = TICKET_SCREEN.show();
    await userEvent
      .setup({ applyAccept: false })
      .upload(shown.input(), [new File(['<svg/>'], 'notes.svg', { type: 'image/svg+xml' })]);
    const area = within(shown.area());
    const dismiss = await waitFor(() =>
      within(area.getByRole('alert')).getByRole('button', { name: 'Dismiss' }),
    );

    ctrlClick(dismiss);
    voiceOverClick(dismiss);

    expect(area.getByRole('button', { name: 'Add files' })).toHaveFocus();
  });

  it('a held screen holds a click with no pointer after a ctrl+click', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    restore.push(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
      document.body.replaceChildren();
    });
    const layer = document.createElement('div');
    const button = document.createElement('button');
    layer.append(button);
    document.body.append(layer);
    holdPresses(button);

    ctrlClick(button);

    expect(voiceOverClick(button)).toBe(false);
  });
});

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { holdPresses } from '../../src/lib/holdPresses';
import { DiscardChangesSheet } from '../../src/overlays/DiscardChangesSheet';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';
import { TICKET_SCREEN, type ShownSurface } from './attachmentSurfaces';

// PT-115: the shields tell a click's pointer by the press before it, and a right-click was taken
// for one. It makes no click, so it stayed until the next click on that element: a click with no
// pointer of its own, such as VoiceOver's, then passed for a mouse's single click. Discard changes
// discarded at once, and Dismiss left focus to fall to the page body.

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

// What a browser sends for a right-click: no click, a context menu.
function rightClick(target: Element) {
  fireEvent.pointerDown(target, { pointerType: 'mouse', button: 2, buttons: 2 });
  fireEvent.mouseDown(target, { button: 2, buttons: 2, detail: 1 });
  fireEvent.contextMenu(target, { button: 2 });
  fireEvent.pointerUp(target, { pointerType: 'mouse', button: 2 });
  fireEvent.mouseUp(target, { button: 2, detail: 1 });
}

const voiceOverClick = (target: Element) => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
  target.dispatchEvent(event);
  return event;
};

describe('regression: a right-click is no press for the next click', () => {
  it('Discard changes holds a click with no pointer after a right-click on its row', () => {
    restore.push(mockPhone(false));
    const onDiscard = vi.fn();
    render(<DiscardChangesSheet open onKeep={vi.fn()} onDiscard={onDiscard} />);
    const row = screen.getByRole('button', { name: 'Discard changes' });

    rightClick(row);
    voiceOverClick(row);

    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("Dismiss moves focus on VoiceOver's click after a right-click on it", async () => {
    shown = TICKET_SCREEN.show();
    await userEvent
      .setup({ applyAccept: false })
      .upload(shown.input(), [new File(['<svg/>'], 'notes.svg', { type: 'image/svg+xml' })]);
    const area = within(shown.area());
    const dismiss = await waitFor(() =>
      within(area.getByRole('alert')).getByRole('button', { name: 'Dismiss' }),
    );

    rightClick(dismiss);
    voiceOverClick(dismiss);

    expect(area.queryByRole('alert')).not.toBeInTheDocument();
    expect(area.getByRole('button', { name: 'Add files' })).toHaveFocus();
  });

  it('a held screen holds a click with no pointer after a right-click', () => {
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

    rightClick(button);

    expect(voiceOverClick(button).defaultPrevented).toBe(true);
  });
});

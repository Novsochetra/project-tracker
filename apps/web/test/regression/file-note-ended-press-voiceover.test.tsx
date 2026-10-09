import { fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { skipAnimations } from '../../src/overlays/testing';
import { TICKET_SCREEN, type ShownSurface } from './attachmentSurfaces';

// PT-106: Dismiss told VoiceOver's click (no pointer before it) from a tap by a pointer press it
// remembered until a click or a pointercancel. A mouse pressed on Dismiss, dragged off and released
// makes no click there, so its press stayed, and VoiceOver's later click passed for a tap: no focus
// moved, and it fell to the page body with the note.

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
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

async function refusedNote() {
  shown = TICKET_SCREEN.show();
  await userEvent
    .setup({ applyAccept: false })
    .upload(shown.input(), [new File(['<svg/>'], 'notes.svg', { type: 'image/svg+xml' })]);
  return waitFor(() => within(area().getByRole('alert')).getByRole('button', { name: 'Dismiss' }));
}

describe('regression: a press that ended without a click on Dismiss', () => {
  it("is forgotten when the mouse is released off it, so VoiceOver's click moves focus", async () => {
    const dismiss = await refusedNote();

    fireEvent.pointerDown(dismiss, { pointerType: 'mouse' });
    fireEvent.pointerUp(document.body, { pointerType: 'mouse' });
    await nextTask();
    fireEvent.click(dismiss, { detail: 1 });

    expect(area().queryByRole('alert')).not.toBeInTheDocument();
    expect(area().getByRole('button', { name: 'Add files' })).toHaveFocus();
  });

  it("is forgotten when the browser cancels it, so VoiceOver's click moves focus", async () => {
    const dismiss = await refusedNote();

    fireEvent.pointerDown(dismiss, { pointerType: 'touch' });
    fireEvent.pointerCancel(dismiss, { pointerType: 'touch' });
    fireEvent.click(dismiss, { detail: 1 });

    expect(area().getByRole('button', { name: 'Add files' })).toHaveFocus();
  });

  // Chromium sends a finger's click a task after its pointerup; the button keeps the finger's
  // pointer, so its pointerup lands there wherever it lifts.
  it("still takes a finger's tap whose click comes a task after it lifts", async () => {
    const dismiss = await refusedNote();

    fireEvent.pointerDown(dismiss, { pointerType: 'touch' });
    fireEvent.pointerUp(dismiss, { pointerType: 'touch' });
    await nextTask();
    fireEvent.click(dismiss, { detail: 1 });

    expect(area().queryByRole('alert')).not.toBeInTheDocument();
    expect(area().getByRole('button', { name: 'Add files' })).not.toHaveFocus();
  });
});

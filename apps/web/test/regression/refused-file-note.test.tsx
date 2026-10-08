import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UNSUPPORTED_ATTACHMENT_MESSAGE } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { skipAnimations } from '../../src/overlays/testing';
import { SURFACES, type ShownSurface } from './attachmentSurfaces';

const svg = () => new File(['<svg/>'], 'notes.svg', { type: 'image/svg+xml' });
const zip = () => new File(['zip'], 'logs.zip', { type: 'application/zip' });
const notes = () => new File(['steps'], 'steps.txt', { type: 'text/plain' });

let shown: ShownSurface | undefined;
let undoAnimations: () => void;

beforeEach(() => {
  undoAnimations = skipAnimations();
});

afterEach(() => {
  shown?.restore();
  undoAnimations();
  vi.useRealTimers();
  localStorage.clear();
});

// On a phone, the reason a file was refused was a one-line toast listing every allowed type, cut
// to "Only images (PNG, JPEG, GIF, WebP, HEIC), …" (at 320px "…GIF, Web…") and gone after 2.2 s,
// so it read as "only images". It now stays in the picker area, short and whole, until the next
// pick or a dismiss.
describe.each(SURFACES)('a refused file in $name', (surface) => {
  it('is named in the picker area with everything that can be attached, until dismissed', async () => {
    const user = userEvent.setup({ applyAccept: false });
    shown = surface.show();
    await user.upload(shown.input(), svg());

    const note = within(shown.area()).getByRole('alert');
    expect(within(note).getByText("notes.svg can't be attached.")).toBeInTheDocument();
    expect(within(note).getByText(UNSUPPORTED_ATTACHMENT_MESSAGE)).toBeInTheDocument();
    expect(note.closest('[role="status"]')).toBeNull();
    expect(shown.client.uploadAttachment).not.toHaveBeenCalled();

    await user.click(within(note).getByRole('button', { name: 'Dismiss' }));
    expect(within(shown.area()).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('outlasts a toast and gives way to the next pick', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ applyAccept: false, advanceTimers: vi.advanceTimersByTime });
    shown = surface.show({ uploadAttachment: vi.fn(() => new Promise(() => undefined)) });
    await user.upload(shown.input(), [svg(), zip()]);
    expect(within(shown.area()).getByRole('alert')).toHaveTextContent(
      "notes.svg and 1 more can't be attached.",
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(within(shown.area()).getByRole('alert')).toBeInTheDocument();

    await user.upload(shown.input(), notes());
    expect(within(shown.area()).queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Uploading steps.txt' })).toBeInTheDocument();
  });
});

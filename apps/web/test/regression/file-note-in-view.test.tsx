import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { skipAnimations } from '../../src/overlays/testing';
import { CAPTURE, NEW_TICKET, type ShownSurface } from './attachmentSurfaces';

const logs = (count: number) =>
  Array.from(
    { length: count },
    (_, index) => new File(['boom'], `crash-report-${index + 1}.log`, { type: 'text/plain' }),
  );

let shown: ShownSurface | undefined;
let undoAnimations: () => void;
type ScrollIntoView = Element['scrollIntoView'];

let scrolled: Mock<ScrollIntoView>;

beforeEach(() => {
  undoAnimations = skipAnimations();
  scrolled = vi.fn<ScrollIntoView>();
  Element.prototype.scrollIntoView = scrolled;
});

afterEach(() => {
  shown?.restore();
  undoAnimations();
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  localStorage.clear();
});

const follows = (first: Element, second: Element) =>
  (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

// At 320×568 the 20 tiles of a 21-file pick filled the sheet and the note that the 21st was left
// out sat under them, below the fold, so someone tapping Create never learned of it (PT-72).
describe.each([NEW_TICKET, CAPTURE])('a file left out of a big pick in $name', (surface) => {
  it('is said above the tiles, where Add files was', async () => {
    const user = userEvent.setup();
    shown = surface.show({ uploadAttachment: vi.fn(() => new Promise(() => undefined)) });
    await user.upload(shown.input(), logs(21));

    const note = within(shown.area()).getByRole('alert');
    expect(note).toHaveTextContent("crash-report-21.log can't be attached.");
    const firstTile = within(shown.area()).getByTitle('crash-report-1.log');
    expect(follows(note, firstTile)).toBe(true);
  });

  it('is scrolled into view, as a pick from the Add tile under many files leaves it out of sight', async () => {
    const user = userEvent.setup();
    shown = surface.show({ uploadAttachment: vi.fn(() => new Promise(() => undefined)) });
    await user.upload(shown.input(), logs(19));
    expect(scrolled).not.toHaveBeenCalled();

    await user.upload(shown.input(), logs(3));
    const note = within(shown.area()).getByRole('alert');
    expect(note).toHaveTextContent("crash-report-2.log and 1 more can't be attached.");
    expect(scrolled).toHaveBeenCalledWith(expect.objectContaining({ block: 'nearest' }));
    expect(scrolled.mock.contexts.at(-1)).toBe(note);
  });

  it("doesn't move the page for an upload that fails later, while the person may be scrolling", async () => {
    const user = userEvent.setup();
    shown = surface.show({
      uploadAttachment: vi.fn().mockRejectedValue(new ApiError(408, 'http_error', 'Timeout')),
    });
    const { area } = shown;
    await user.upload(shown.input(), logs(1));

    await waitFor(() =>
      expect(within(area()).getByRole('alert')).toHaveTextContent(
        "crash-report-1.log didn't upload.",
      ),
    );
    expect(scrolled).not.toHaveBeenCalled();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OpeningMark } from '../../src/features/attachments/OpeningMark';

afterEach(() => {
  vi.restoreAllMocks();
});

// WebKit leaves an element added while a stylesheet loads unstyled and undrawn until the sheet is
// in, and the viewer part's CSS starts loading with the press on a tile: on an iPhone with slow CSS
// the tile's spinner never showed (PT-114). Asking for the mark's box styles it at once. The E2E
// viewer-opening-mark.spec.ts checks it in WebKit.
it('asks for its box as it shows, so WebKit draws it while a stylesheet loads', () => {
  const boxes = vi.spyOn(Element.prototype, 'getBoundingClientRect');
  render(<OpeningMark overIcon={false} />);
  const mark = screen.getByText('Opening').closest('.quiet-in');
  expect(mark).toBeInTheDocument();
  expect(boxes.mock.contexts).toContain(mark);
});

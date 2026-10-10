import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NETWORK_ERROR_MESSAGE } from '../../src/api';
import { OfflineBanner } from '../../src/app/OfflineBanner';

afterEach(() => {
  vi.restoreAllMocks();
});

// WebKit leaves an element added while a stylesheet loads unstyled and undrawn until the sheet is
// in, and the banner comes on its own when the connection drops, which on a slow network can be
// while a part's CSS is on its way: in WebKit with a held stylesheet it stayed unseen for as long
// as the sheet was held (PT-129). Asking for the banner's box styles it at once. The E2E
// while-css-loads.spec.ts checks it in WebKit.
it('asks for its box as it shows, so WebKit draws it while a stylesheet loads', () => {
  const boxes = vi.spyOn(Element.prototype, 'getBoundingClientRect');
  render(<OfflineBanner />);
  const banner = screen.getByText(NETWORK_ERROR_MESSAGE).parentElement;
  expect(boxes.mock.contexts).toContain(banner);
});

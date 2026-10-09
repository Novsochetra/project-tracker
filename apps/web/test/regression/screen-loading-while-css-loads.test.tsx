import { screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ScreenLoading } from '../../src/app/ScreenLoading';
import { renderWithApp } from '../../src/app/test/harness';
import { mockPhone } from '../../src/overlays/testing';

let restore: () => void = () => undefined;

afterEach(() => {
  restore();
  vi.restoreAllMocks();
});

// WebKit leaves an element added while a stylesheet loads unstyled and undrawn until the sheet is
// in, and a deep link starts its screens' stylesheets with their code: on an iPhone, a ticket
// opened from a link on a slow network showed a blank page, no bar, Back or spinner, until the
// screen's code came (PT-116). Asking for the loading state's box styles it at once. The E2E
// while-css-loads.spec.ts checks it in WebKit.
it('asks for its box as it shows, so WebKit draws it while a stylesheet loads', () => {
  restore = mockPhone(true);
  const boxes = vi.spyOn(Element.prototype, 'getBoundingClientRect');
  renderWithApp(<ScreenLoading quiet />, { path: '/p/MOB' });
  const loading = screen.getByRole('button', { name: 'Back to Projects' }).closest('.quiet-in');
  expect(loading).not.toBeNull();
  expect(boxes.mock.contexts).toContain(loading);
});

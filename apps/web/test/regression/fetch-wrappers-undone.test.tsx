import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setupApi } from '../../src/api/test/render';
import { useReachability } from '../../src/app/useApiUnreachable';

// PT-221 review: the saved-answer and live-read wrappers were put on window.fetch in two layout
// effects, which React undoes in the order they were declared. The first undo then put back a
// fetch the second had already wrapped, so after an unmount fetch was still wrapped, and every
// remount (sign-out, StrictMode, a hot reload) added one more wrapper.

const original = vi.fn(() => Promise.resolve(Response.json({})));

beforeEach(() => vi.stubGlobal('fetch', original));
afterEach(() => vi.unstubAllGlobals());

const mount = (reactStrictMode = false) =>
  renderHook(() => useReachability(), { wrapper: setupApi().wrapper, reactStrictMode });

it('puts window.fetch back as it was once the app goes', () => {
  const first = mount();
  expect(window.fetch).not.toBe(original);
  first.unmount();
  expect(window.fetch).toBe(original);

  mount().unmount();
  expect(window.fetch).toBe(original);
});

it('wraps window.fetch once, also when StrictMode mounts the app twice', () => {
  const app = mount(true);
  app.unmount();
  expect(window.fetch).toBe(original);
});

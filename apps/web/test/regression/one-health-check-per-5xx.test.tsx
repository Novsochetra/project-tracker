import { MutationObserver } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setupApi } from '../../src/api/test/render';
import { useReachability } from '../../src/app/useApiUnreachable';
import { ToastProvider } from '../../src/components';
import { useTicketDrafts } from '../../src/features/ticket/drafts/useTicketDrafts';

// The app's banner and the draft retries each checked a bare 5xx with a GET /api/health of their
// own, so every one sent two at once (PT-101 review).

function Watchers() {
  useTicketDrafts(true);
  useReachability();
  return null;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('checks the tracker once for a bare 5xx that both the banner and the draft retries see', async () => {
  const checkHealth = vi.fn().mockResolvedValue({ ok: true });
  const api = setupApi({ checkHealth });
  render(
    <api.wrapper>
      <ToastProvider>
        <Watchers />
      </ToastProvider>
    </api.wrapper>,
  );
  const bare500 = new ApiError(500, 'http_error', 'Internal Server Error');

  await act(() =>
    new MutationObserver(api.queryClient, { mutationFn: () => Promise.reject(bare500) })
      .mutate()
      .catch(() => undefined),
  );
  await waitFor(() => expect(checkHealth).toHaveBeenCalled());
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

  expect(checkHealth).toHaveBeenCalledTimes(1);
});

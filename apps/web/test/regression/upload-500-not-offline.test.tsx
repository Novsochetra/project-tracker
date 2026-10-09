import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import { describe, expect, it, vi } from 'vitest';
import { useUploadAttachment } from '../../src/api';
import { setupApi } from '../../src/api/test/render';
import { useApiUnreachable, useReachability } from '../../src/app/useApiUnreachable';

// One file's upload answered with a bare 500 (no error body) put "Can't reach the tracker" over
// the whole app, though the tracker still answered everything else (PT-101). A proxy in front of a
// stopped API answers the same way, so then the banner still shows.

const bare500 = () => new ApiError(500, 'http_error', 'Internal Server Error');
const file = new File(['log'], 'late.log', { type: 'text/plain' });

function renderShell(client: Parameters<typeof setupApi>[0]) {
  const { wrapper } = setupApi(client);
  return renderHook(
    () => {
      const reachability = useReachability();
      return { unreachable: useApiUnreachable(reachability), upload: useUploadAttachment() };
    },
    { wrapper },
  );
}

async function failUpload(client: Parameters<typeof setupApi>[0]) {
  const shell = renderShell({ uploadAttachment: vi.fn().mockRejectedValue(bare500()), ...client });
  await act(() => shell.result.current.upload.mutateAsync({ file }).catch(() => undefined));
  return shell;
}

describe('regression: a bare 500 on one upload', () => {
  it("doesn't say the tracker can't be reached while it still answers", async () => {
    const checkHealth = vi.fn().mockResolvedValue({ ok: true });
    const { result } = await failUpload({ checkHealth });

    await waitFor(() => expect(checkHealth).toHaveBeenCalledTimes(1));
    expect(result.current.unreachable).toBe(false);
  });

  it('says so when the tracker gives no answer either: a proxy for a stopped API', async () => {
    const { result } = await failUpload({ checkHealth: vi.fn().mockRejectedValue(bare500()) });

    await waitFor(() => expect(result.current.unreachable).toBe(true));
  });

  it('says so when the check fails to reach it at all', async () => {
    const { result } = await failUpload({
      checkHealth: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    });

    await waitFor(() => expect(result.current.unreachable).toBe(true));
  });
});

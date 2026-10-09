import { describe, expect, it, vi } from 'vitest';
import { forgetSavedAnswers } from './forgetSavedAnswers';

const SIGNED_OUT = { authRequired: true, authenticated: false };

function fakeStorage() {
  const put = vi.fn((_request: Request, _response: Response) => Promise.resolve());
  const storage = {
    delete: vi.fn(() => Promise.resolve(true)),
    open: vi.fn(() => Promise.resolve({ put })),
  };
  return { storage, put };
}

describe('forgetSavedAnswers', () => {
  it('empties the API and attachment caches and saves the signed-out session', async () => {
    const { storage, put } = fakeStorage();
    await forgetSavedAnswers(SIGNED_OUT, storage as unknown as CacheStorage);
    expect(storage.delete.mock.calls).toEqual([['api'], ['attachments']]);
    expect(storage.open).toHaveBeenCalledWith('api');
    const [request, response] = put.mock.calls[0]!;
    expect(request.url).toBe(`${location.origin}/api/session`);
    expect(await response.json()).toEqual(SIGNED_OUT);
  });

  it('does nothing without Cache Storage, and gives up quietly when it fails', async () => {
    await expect(forgetSavedAnswers(SIGNED_OUT, undefined)).resolves.toBeUndefined();
    const failing = { delete: () => Promise.reject(new Error('blocked')) };
    await expect(
      forgetSavedAnswers(SIGNED_OUT, failing as unknown as CacheStorage),
    ).resolves.toBeUndefined();
  });
});

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLogin, useSession } from '../../src/api/hooks/session';
import { setupApi } from '../../src/api/test/render';

const signedOut = { authRequired: true, authenticated: false };
const signedIn = { authRequired: true, authenticated: true };

// The service worker keeps the last GET /api/session answer for starts without the server.
// Signing in only stored the new session in the app, so the saved answer still said signed out
// and an offline reload showed the sign-in screen, which can't be used offline.
describe('regression: signing in refreshes the saved session answer', () => {
  it('reads the session again after a sign-in and keeps the sign-in answer', async () => {
    // The second answer stands for a slow network, where the worker answers from its saved copy.
    const getSession = vi.fn().mockResolvedValue(signedOut);
    const { wrapper } = setupApi({ getSession, login: vi.fn().mockResolvedValue(signedIn) });
    const { result } = renderHook(() => ({ session: useSession(), login: useLogin() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.session.data).toEqual(signedOut));

    act(() => result.current.login.mutate({ email: 'owner@example.com', password: 'secret' }));

    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(2));
    expect(result.current.session.data).toEqual(signedIn);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { reloadsAsked } from '../lib/pageReload';
import { checkForUpdates } from './checkForUpdates';
import { registerOptions } from './registerOptions';
import { reloadWhenSafe } from './reloadWhenSafe';

vi.mock('./checkForUpdates', () => ({ checkForUpdates: vi.fn() }));
vi.mock('./reloadWhenSafe', () => ({ reloadWhenSafe: vi.fn() }));

const registration = { update: () => Promise.resolve() } as unknown as ServiceWorkerRegistration;

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('registerOptions', () => {
  it('waits for a safe moment instead of reloading straight away', () => {
    const reload = vi.fn();
    const reloads = reloadsAsked();
    registerOptions(reload).onNeedReload?.();
    expect(reload).not.toHaveBeenCalled();
    vi.mocked(reloadWhenSafe).mock.calls[0]?.[0]();
    expect(reload).toHaveBeenCalledTimes(1);
    // So a push waiting meanwhile adds no history entry for the reload to fill (PT-108).
    expect(reloadsAsked()).toBe(reloads + 1);
  });

  it('starts checking for updates once the service worker is registered', () => {
    registerOptions(vi.fn()).onRegisteredSW?.('/sw.js', registration);
    expect(checkForUpdates).toHaveBeenCalledWith(registration);
  });

  it('does not check for updates when registration gave no service worker', () => {
    registerOptions(vi.fn()).onRegisteredSW?.('/sw.js', undefined);
    expect(checkForUpdates).not.toHaveBeenCalled();
  });

  it('warns when registration fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = new Error('blocked');
    registerOptions(vi.fn()).onRegisterError?.(error);
    expect(warn).toHaveBeenCalledWith('Service worker registration failed', error);
  });
});

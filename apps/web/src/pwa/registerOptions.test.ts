import { afterEach, describe, expect, it, vi } from 'vitest';
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
    registerOptions(reload).onNeedReload?.();
    expect(reloadWhenSafe).toHaveBeenCalledWith(reload);
    expect(reload).not.toHaveBeenCalled();
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

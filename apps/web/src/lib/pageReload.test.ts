import { describe, expect, it, vi } from 'vitest';
import { isPageReloading, reloadPage } from './pageReload';

describe('reloadPage', () => {
  it('reloads, and says so from then on', () => {
    const reload = vi.fn();
    expect(isPageReloading()).toBe(false);
    reloadPage(reload);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(isPageReloading()).toBe(true);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { reloadPage, reloadsAsked } from './pageReload';

describe('reloadPage', () => {
  it('reloads, and counts each reload asked for', () => {
    const reload = vi.fn();
    const before = reloadsAsked();
    reloadPage(reload);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadsAsked()).toBe(before + 1);
    reloadPage(reload);
    expect(reloadsAsked()).toBe(before + 2);
  });
});

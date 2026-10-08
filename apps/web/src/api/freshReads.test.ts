import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changesBefore,
  FRESH_READS_STORAGE_KEY,
  keepFreshReadsOnReload,
  markChanged,
  markRead,
} from './freshReads';

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const reload = () => window.dispatchEvent(new Event('pagehide'));

describe('fresh reads after a change', () => {
  it('reads a ticket as usual until it changes', () => {
    expect(changesBefore(new QueryClient(), 'MOB-1')).toBeUndefined();
  });

  it('reads a changed ticket fresh until a fresh read lands', () => {
    const queryClient = new QueryClient();
    markChanged(queryClient, 'MOB-1');
    const changes = changesBefore(queryClient, 'mob-1');
    expect(changes).toBe(1);
    expect(changesBefore(queryClient, 'MOB-2')).toBeUndefined();
    markRead(queryClient, 'MOB-1', changes ?? 0);
    expect(changesBefore(queryClient, 'MOB-1')).toBeUndefined();
  });

  it('keeps reading fresh when another change settled while the read was on its way', () => {
    const queryClient = new QueryClient();
    markChanged(queryClient, 'MOB-1');
    const changes = changesBefore(queryClient, 'MOB-1') ?? 0;
    markChanged(queryClient, 'MOB-1');
    markRead(queryClient, 'MOB-1', changes);
    expect(changesBefore(queryClient, 'MOB-1')).toBe(2);
  });

  it('keeps each query client to itself', () => {
    const written = new QueryClient();
    markChanged(written, 'MOB-1');
    expect(changesBefore(new QueryClient(), 'MOB-1')).toBeUndefined();
  });
});

describe('fresh reads across a reload', () => {
  it('leaves what the page had not read fresh yet to the next page', () => {
    const page = new QueryClient();
    const stop = keepFreshReadsOnReload(page);
    markChanged(page, 'MOB-1');
    markChanged(page, 'MOB-2');
    markRead(page, 'MOB-2', 1);
    reload();
    stop();

    const next = new QueryClient();
    expect(changesBefore(next, 'MOB-1')).toBe(1);
    expect(changesBefore(next, 'MOB-2')).toBeUndefined();
    expect(changesBefore(new QueryClient(), 'MOB-1')).toBeUndefined();
    expect(window.sessionStorage.getItem(FRESH_READS_STORAGE_KEY)).toBeNull();
  });

  it('leaves nothing when every change was read fresh', () => {
    window.sessionStorage.setItem(FRESH_READS_STORAGE_KEY, '{"MOB-9":1}');
    const page = new QueryClient();
    const stop = keepFreshReadsOnReload(page);
    markRead(page, 'MOB-9', 1);
    reload();
    stop();
    expect(window.sessionStorage.getItem(FRESH_READS_STORAGE_KEY)).toBeNull();
  });

  it('stops listening once the page lets go of its query client', () => {
    const page = new QueryClient();
    keepFreshReadsOnReload(page)();
    markChanged(page, 'MOB-1');
    reload();
    expect(window.sessionStorage.getItem(FRESH_READS_STORAGE_KEY)).toBeNull();
  });

  it('ignores what it cannot read, and reads as usual without session storage', () => {
    window.sessionStorage.setItem(FRESH_READS_STORAGE_KEY, '{"MOB-1":"x","MOB-2":2}');
    expect(changesBefore(new QueryClient(), 'MOB-1')).toBeUndefined();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const page = new QueryClient();
    const stop = keepFreshReadsOnReload(page);
    markChanged(page, 'MOB-1');
    expect(() => reload()).not.toThrow();
    stop();
    expect(changesBefore(page, 'MOB-1')).toBe(1);
  });
});

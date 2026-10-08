import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changesBefore,
  FRESH_READ_MARK_MS,
  FRESH_READS_STORAGE_KEY,
  markChanged,
  markRead,
} from './freshReads';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// Each page of the app has a query client of its own; storage is shared with the other pages.
const newPage = () => new QueryClient();

const readFresh = (page: QueryClient, ticketKey: string) => {
  const changes = changesBefore(page, ticketKey);
  if (changes !== undefined) markRead(page, ticketKey, changes);
};

describe('fresh reads after a change', () => {
  it('reads a ticket as usual until it changes', () => {
    expect(changesBefore(newPage(), 'MOB-1')).toBeUndefined();
  });

  it('reads a changed ticket fresh until a fresh read lands', () => {
    const page = newPage();
    markChanged(page, 'MOB-1');
    const changes = changesBefore(page, 'mob-1');
    expect(changes).toBe(1);
    expect(changesBefore(page, 'MOB-2')).toBeUndefined();
    markRead(page, 'MOB-1', changes ?? 0);
    expect(changesBefore(page, 'MOB-1')).toBeUndefined();
  });

  it('keeps reading fresh when another change settled while the read was on its way', () => {
    const page = newPage();
    markChanged(page, 'MOB-1');
    const changes = changesBefore(page, 'MOB-1') ?? 0;
    markChanged(page, 'MOB-1');
    markRead(page, 'MOB-1', changes);
    expect(changesBefore(page, 'MOB-1')).toBe(2);
  });
});

describe('fresh reads in pages opened later', () => {
  it('read fresh what another page changed and nobody read fresh since', () => {
    const page = newPage();
    markChanged(page, 'MOB-1');
    markChanged(page, 'MOB-2');
    readFresh(page, 'MOB-2');

    const later = newPage();
    expect(changesBefore(later, 'MOB-1')).toBe(0);
    expect(changesBefore(later, 'MOB-2')).toBeUndefined();
    expect(changesBefore(page, 'MOB-1')).toBe(1);
  });

  it('stop once any page read the ticket fresh', () => {
    markChanged(newPage(), 'MOB-1');
    readFresh(newPage(), 'MOB-1');
    expect(changesBefore(newPage(), 'MOB-1')).toBeUndefined();
    expect(window.localStorage.getItem(FRESH_READS_STORAGE_KEY)).toBeNull();
  });

  it('keep the mark when another page changed the ticket while the read was on its way', () => {
    const changer = newPage();
    markChanged(changer, 'MOB-1');
    const reader = newPage();
    const changes = changesBefore(reader, 'MOB-1') ?? -1;
    vi.useFakeTimers({ now: Date.now() + 1 });
    markChanged(changer, 'MOB-1');
    markRead(reader, 'MOB-1', changes);
    expect(changesBefore(reader, 'MOB-1')).toBeUndefined();
    expect(changesBefore(newPage(), 'MOB-1')).toBe(0);
  });

  it('forget a change nobody read fresh after a day', () => {
    vi.useFakeTimers();
    markChanged(newPage(), 'MOB-1');
    vi.advanceTimersByTime(FRESH_READ_MARK_MS);
    expect(changesBefore(newPage(), 'MOB-1')).toBeUndefined();
  });

  it('ignore what they cannot read, and read as usual without storage', () => {
    window.localStorage.setItem(FRESH_READS_STORAGE_KEY, '{"MOB-1":"x","MOB-2":null}');
    expect(changesBefore(newPage(), 'MOB-1')).toBeUndefined();
    expect(changesBefore(newPage(), 'MOB-2')).toBeUndefined();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const page = newPage();
    expect(() => markChanged(page, 'MOB-1')).not.toThrow();
    expect(changesBefore(page, 'MOB-1')).toBe(1);
    expect(changesBefore(newPage(), 'MOB-1')).toBeUndefined();
  });
});

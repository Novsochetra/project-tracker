import { describe, expect, it } from 'vitest';
import { isDraftRecord, latestOf, type DraftRecord, type Held } from './draftRecord';

const record = (text: string, at: number): DraftRecord => ({
  ticketKey: 'MOB-3',
  field: 'title',
  base: 'Fix login',
  text,
  at,
});

const held = (key: string, kept: DraftRecord): Held => ({ key, record: kept });

describe('the latest record of a draft', () => {
  it('has the text typed last', () => {
    const typedLast = held('a', record('Fix it now', 20));
    expect(latestOf([held('b', record('Fix it', 10)), typedLast])).toBe(typedLast);
  });

  it('is one every tab agrees on for text typed at the same time', () => {
    const [first, second] = [held('a', record('Fix it', 10)), held('b', record('Fix this', 10))];
    expect(latestOf([first, second])).toBe(second);
    expect(latestOf([second, first])).toBe(second);
  });

  it('is none for no records', () => {
    expect(latestOf([])).toBeUndefined();
  });
});

describe('a record', () => {
  it('is read only with the time it was typed', () => {
    expect(isDraftRecord(record('Fix it', 10))).toBe(true);
    expect(isDraftRecord({ ...record('Fix it', 10), at: undefined })).toBe(false);
    expect(isDraftRecord({ ...record('Fix it', 10), field: 'priority' })).toBe(false);
    expect(isDraftRecord({ ...record('Fix it', 10), changed: 'yes' })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { dayForKey } from './calendarKeys';

const SUNDAY = 0;
const MONDAY = 1;

const press = (
  key: string,
  modifiers: Partial<Record<'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey', boolean>> = {},
) => ({
  key,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...modifiers,
});

describe('dayForKey', () => {
  it('moves a day with the left and right arrows, across month edges', () => {
    expect(dayForKey(press('ArrowRight'), '2026-10-08', SUNDAY)).toBe('2026-10-09');
    expect(dayForKey(press('ArrowLeft'), '2026-10-08', SUNDAY)).toBe('2026-10-07');
    expect(dayForKey(press('ArrowLeft'), '2026-10-01', SUNDAY)).toBe('2026-09-30');
    expect(dayForKey(press('ArrowRight'), '2026-12-31', SUNDAY)).toBe('2027-01-01');
  });

  it('moves a week with the up and down arrows', () => {
    expect(dayForKey(press('ArrowDown'), '2026-10-29', SUNDAY)).toBe('2026-11-05');
    expect(dayForKey(press('ArrowUp'), '2026-10-03', SUNDAY)).toBe('2026-09-26');
  });

  it('moves a month with Page Up and Page Down, clamped to shorter months', () => {
    expect(dayForKey(press('PageDown'), '2026-10-08', SUNDAY)).toBe('2026-11-08');
    expect(dayForKey(press('PageUp'), '2026-03-31', SUNDAY)).toBe('2026-02-28');
    expect(dayForKey(press('PageUp'), '2028-03-31', SUNDAY)).toBe('2028-02-29');
    expect(dayForKey(press('PageDown'), '2026-12-15', SUNDAY)).toBe('2027-01-15');
  });

  it('goes to the start and end of the week with Home and End', () => {
    expect(dayForKey(press('Home'), '2026-10-08', SUNDAY)).toBe('2026-10-04');
    expect(dayForKey(press('End'), '2026-10-08', SUNDAY)).toBe('2026-10-10');
    expect(dayForKey(press('Home'), '2026-10-08', MONDAY)).toBe('2026-10-05');
    expect(dayForKey(press('End'), '2026-10-08', MONDAY)).toBe('2026-10-11');
    expect(dayForKey(press('Home'), '2026-10-01', SUNDAY)).toBe('2026-09-27');
  });

  it('leaves other keys and modified keys to the browser', () => {
    expect(dayForKey(press('Enter'), '2026-10-08', SUNDAY)).toBeNull();
    expect(dayForKey(press(' '), '2026-10-08', SUNDAY)).toBeNull();
    expect(dayForKey(press('Tab'), '2026-10-08', SUNDAY)).toBeNull();
    expect(dayForKey(press('a'), '2026-10-08', SUNDAY)).toBeNull();
    expect(dayForKey(press('ArrowLeft', { altKey: true }), '2026-10-08', SUNDAY)).toBeNull();
    expect(dayForKey(press('ArrowLeft', { metaKey: true }), '2026-10-08', SUNDAY)).toBeNull();
    expect(dayForKey(press('ArrowRight', { ctrlKey: true }), '2026-10-08', SUNDAY)).toBeNull();
    expect(dayForKey(press('PageDown', { shiftKey: true }), '2026-10-08', SUNDAY)).toBeNull();
  });
});

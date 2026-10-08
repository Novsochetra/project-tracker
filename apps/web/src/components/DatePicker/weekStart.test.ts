import { afterEach, describe, expect, it } from 'vitest';
import { localeWeekStart } from './weekStart';

const SUNDAY = 0;
const MONDAY = 1;
const SATURDAY = 6;

const prototype = Intl.Locale.prototype as Intl.Locale & Record<string, unknown>;
const restores: Array<() => void> = [];

function replaceOnLocale(name: string, descriptor: PropertyDescriptor) {
  const previous = Object.getOwnPropertyDescriptor(prototype, name);
  Object.defineProperty(prototype, name, { configurable: true, ...descriptor });
  restores.push(() => {
    if (previous) Object.defineProperty(prototype, name, previous);
    else Reflect.deleteProperty(prototype, name);
  });
}

afterEach(() => {
  restores
    .splice(0)
    .reverse()
    .forEach((restore) => restore());
});

describe('localeWeekStart', () => {
  it("reads the locale's first day of the week", () => {
    expect(localeWeekStart('en-US')).toBe(SUNDAY);
    expect(localeWeekStart('en-GB')).toBe(MONDAY);
    expect(localeWeekStart('fr-FR')).toBe(MONDAY);
  });

  it('uses getWeekInfo where the browser has it', () => {
    replaceOnLocale('getWeekInfo', { value: () => ({ firstDay: 6 }) });
    expect(localeWeekStart('en-US')).toBe(SATURDAY);
  });

  it('falls back to Sunday when the browser cannot tell', () => {
    replaceOnLocale('getWeekInfo', { value: undefined });
    replaceOnLocale('weekInfo', { get: () => undefined });
    expect(localeWeekStart('en-GB')).toBe(SUNDAY);
  });

  it('falls back to Sunday without a locale or with a broken one', () => {
    expect(localeWeekStart(undefined)).toBe(SUNDAY);
    expect(localeWeekStart('not a locale!')).toBe(SUNDAY);
    replaceOnLocale('getWeekInfo', { value: () => ({ firstDay: 9 }) });
    expect(localeWeekStart('en-GB')).toBe(SUNDAY);
  });
});

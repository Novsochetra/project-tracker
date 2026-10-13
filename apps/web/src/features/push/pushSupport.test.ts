import { expect, it } from 'vitest';
import { pushSupportOf } from './pushSupport';

const BROWSER = { canPush: true, permission: 'default', ios: false, standalone: false } as const;

it('tells apart a browser that can push, one that blocked it, and one without push', () => {
  expect(pushSupportOf(BROWSER)).toBe('ready');
  expect(pushSupportOf({ ...BROWSER, permission: 'granted' })).toBe('ready');
  expect(pushSupportOf({ ...BROWSER, permission: 'denied' })).toBe('blocked');
  expect(pushSupportOf({ ...BROWSER, canPush: false })).toBe('unsupported');
});

it('sends an iPhone without push to the Home Screen, where Safari has it', () => {
  expect(pushSupportOf({ ...BROWSER, canPush: false, ios: true })).toBe('home-screen');
  expect(pushSupportOf({ ...BROWSER, canPush: false, ios: true, standalone: true })).toBe(
    'unsupported',
  );
});

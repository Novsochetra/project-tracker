import { expect, it } from 'vitest';
import { OPEN_MESSAGE, openPathOf } from './openMessage';

it('takes only a path in the app from the service worker’s message', () => {
  expect(openPathOf({ type: OPEN_MESSAGE, path: '/p/MOB/3' })).toBe('/p/MOB/3');
  expect(openPathOf({ type: OPEN_MESSAGE, path: '//evil.example/' })).toBeNull();
  expect(openPathOf({ type: OPEN_MESSAGE, path: 'https://evil.example/' })).toBeNull();
  expect(openPathOf({ type: 'other', path: '/p/MOB/3' })).toBeNull();
  expect(openPathOf('tracker:open')).toBeNull();
  expect(openPathOf(null)).toBeNull();
});

import { describe, expect, it } from 'vitest';
import { isLoopbackHost } from '../src/logic/loopback';

describe('isLoopbackHost', () => {
  it.each(['127.0.0.1', 'localhost', '::1', '[::1]', '127.0.1.1', 'LOCALHOST', ' localhost '])(
    'counts %j as this computer',
    (host) => {
      expect(isLoopbackHost(host)).toBe(true);
    },
  );

  it.each([
    '0.0.0.0',
    '::',
    '192.168.1.10',
    'tracker.example.com',
    'tracker.localhost',
    'localhost.example.com',
    '127.0.0.1.example.com',
    '',
  ])('does not count %j', (host) => {
    expect(isLoopbackHost(host)).toBe(false);
  });
});

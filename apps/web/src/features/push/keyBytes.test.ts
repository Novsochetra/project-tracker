import { expect, it } from 'vitest';
import { keyBytes } from './keyBytes';

it('reads a base64url key into its bytes', () => {
  expect([...keyBytes('BP4z-_8')]).toEqual([0x04, 0xfe, 0x33, 0xfb, 0xff]);
});

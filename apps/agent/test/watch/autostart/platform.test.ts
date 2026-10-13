import { describe, expect, it } from 'vitest';
import { macAutostart } from '../../../src/watch/autostart/mac';
import { autostartOn, requireAutostart } from '../../../src/watch/autostart/platform';

describe('which way the helper starts by itself', () => {
  it('is launchd on macOS and systemd on Linux', () => {
    expect(autostartOn('darwin')).toBe(macAutostart);
    expect(autostartOn('linux')).toMatchObject({ install: expect.any(Function) });
    expect(autostartOn('linux')).not.toBe(macAutostart);
  });

  it('is none elsewhere, and installing there says where it works', () => {
    expect(autostartOn('win32')).toBeUndefined();
    expect(() => requireAutostart('win32')).toThrow(
      'Starting by itself works on macOS and Linux only.',
    );
  });
});

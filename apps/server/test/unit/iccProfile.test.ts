import { describe, expect, it } from 'vitest';
import { isWellFormedIccProfile } from '../../src/images/iccProfile';
import { iccProfile, withTagPastEnd } from '../helpers/iccProfiles';

function withTail(profile: Buffer, tail: number[]): Buffer {
  const grown = Buffer.concat([profile, Buffer.from(tail)]);
  grown.writeUInt32BE(grown.length, 0);
  return grown;
}

describe('isWellFormedIccProfile', () => {
  it.each(['srgb', 'p3', 'cmyk'] as const)('passes a real %s profile', async (name) => {
    expect(isWellFormedIccProfile(await iccProfile(name))).toBe(true);
  });

  it('passes up to three zero bytes of padding, and nothing more', async () => {
    const srgb = await iccProfile('srgb');
    expect(isWellFormedIccProfile(withTail(srgb, [0, 0, 0]))).toBe(true);
    expect(isWellFormedIccProfile(withTail(srgb, [0, 0, 0, 0]))).toBe(false);
    expect(isWellFormedIccProfile(withTail(srgb, [0x47]))).toBe(false);
  });

  it('passes tags that share their data', async () => {
    const srgb = await iccProfile('srgb');
    const offsets = Array.from({ length: srgb.readUInt32BE(128) }, (_, tag) =>
      srgb.readUInt32BE(136 + tag * 12),
    );
    expect(new Set(offsets).size).toBeLessThan(offsets.length);
    expect(isWellFormedIccProfile(srgb)).toBe(true);
  });

  it('fails a profile whose size, signature or tags are wrong', async () => {
    const srgb = await iccProfile('srgb');
    const shortened = Buffer.from(srgb);
    shortened.writeUInt32BE(srgb.length - 4, 0);
    const unsigned = Buffer.from(srgb);
    unsigned.write('nope', 36, 'latin1');
    const tableTooLong = Buffer.from(srgb);
    tableTooLong.writeUInt32BE(0xffffffff, 128);
    for (const broken of [shortened, unsigned, tableTooLong, withTagPastEnd(srgb)]) {
      expect(isWellFormedIccProfile(broken)).toBe(false);
    }
    expect(isWellFormedIccProfile(srgb.subarray(0, 100))).toBe(false);
  });
});

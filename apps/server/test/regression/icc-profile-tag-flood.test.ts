import { describe, expect, it } from 'vitest';
import { MAX_ICC_TAGS, isWellFormedIccProfile } from '../../src/images/iccProfile';

// PT-175 review: the tag count had no bound, so a 15 MB profile of 1.25 million empty tags passed
// after 400 ms and 120 MB on the main thread. Real profiles have about 20 tags.
function emptyTags(count: number): Buffer {
  const tableEnd = 132 + 12 * count;
  const profile = Buffer.alloc(tableEnd);
  profile.writeUInt32BE(tableEnd, 0);
  profile.write('acsp', 36, 'latin1');
  profile.writeUInt32BE(count, 128);
  for (let at = 132; at < tableEnd; at += 12) profile.writeUInt32BE(tableEnd, at + 4);
  return profile;
}

describe('an ICC profile with a flood of tags', () => {
  it('passes up to the limit and fails past it', () => {
    expect(isWellFormedIccProfile(emptyTags(MAX_ICC_TAGS))).toBe(true);
    expect(isWellFormedIccProfile(emptyTags(MAX_ICC_TAGS + 1))).toBe(false);
  });
});

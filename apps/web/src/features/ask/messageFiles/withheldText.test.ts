import { describe, expect, it } from 'vitest';
import { attachment } from '../../../api/test/fixtures';
import { withheldText } from './withheldText';

const heic = (name: string) => attachment(name, { fileName: name, mimeType: 'image/heic' });

describe('withheldText', () => {
  it('names the photos Claude never gets', () => {
    expect(withheldText([attachment('board'), heic('IMG_1.heic')])).toBe(
      "Claude won't get IMG_1.heic: the tracker can't remove its location.",
    );
    expect(withheldText([heic('IMG_1.heic'), heic('IMG_2.heic')])).toBe(
      "Claude won't get IMG_1.heic, IMG_2.heic: the tracker can't remove their location.",
    );
  });

  it('says nothing when Claude gets every file', () => {
    expect(
      withheldText([attachment('board'), attachment('n', { mimeType: 'text/plain' })]),
    ).toBeNull();
  });
});

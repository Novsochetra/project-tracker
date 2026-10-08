import { describe, expect, it } from 'vitest';
import { acceptedEncodings } from '../../src/http/acceptEncoding';

describe('acceptedEncodings', () => {
  it('lists the encodings the build has copies for, brotli first', () => {
    expect(acceptedEncodings('gzip, deflate, br, zstd')).toEqual(['br', 'gzip']);
    expect(acceptedEncodings('gzip, deflate')).toEqual(['gzip']);
    expect(acceptedEncodings('identity')).toEqual([]);
    expect(acceptedEncodings('')).toEqual([]);
  });

  it('reads codings and the q parameter in any letter case', () => {
    expect(acceptedEncodings('BR, Gzip')).toEqual(['br', 'gzip']);
    expect(acceptedEncodings('br;Q=0, GZIP;q=1')).toEqual(['gzip']);
  });

  it('takes any weight above zero and refuses q=0 in any spelling', () => {
    expect(acceptedEncodings('br;q=1, gzip;q=0.001')).toEqual(['br', 'gzip']);
    expect(acceptedEncodings('gzip;q=0.5, br;q=0.8')).toEqual(['br', 'gzip']);
    expect(acceptedEncodings('br ; q=0.000, gzip;q=0.0')).toEqual([]);
  });

  it('refuses an entry whose weight it cannot read', () => {
    expect(acceptedEncodings('br;q=, gzip;q=high')).toEqual([]);
  });

  it('lets * stand for every coding the header does not name', () => {
    expect(acceptedEncodings('*')).toEqual(['br', 'gzip']);
    expect(acceptedEncodings('br;q=0, *')).toEqual(['gzip']);
    expect(acceptedEncodings('gzip, *;q=0')).toEqual(['gzip']);
  });
});

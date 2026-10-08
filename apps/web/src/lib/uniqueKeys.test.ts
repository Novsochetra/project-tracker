import { describe, expect, it } from 'vitest';
import { uniqueKeys } from './uniqueKeys';

describe('uniqueKeys', () => {
  it('keys each entry by its id', () => {
    expect(uniqueKeys(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('numbers entries without a string id among themselves', () => {
    expect(uniqueKeys(['a', undefined, 'b', null, 5])).toEqual([
      'a',
      'spare-0',
      'b',
      'spare-1',
      'spare-2',
    ]);
  });

  it('gives a repeated id a spare key and keeps the first one’s', () => {
    expect(uniqueKeys(['a', 'a', 'b', 'a'])).toEqual(['a', 'spare-0', 'b', 'spare-1']);
  });

  it('never gives a spare key that is one of the ids', () => {
    expect(uniqueKeys([null, 'spare-0', null, 'spare-2'])).toEqual([
      'spare-1',
      'spare-0',
      'spare-3',
      'spare-2',
    ]);
  });
});

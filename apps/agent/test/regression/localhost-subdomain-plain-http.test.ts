import { describe, expect, it } from 'vitest';
import { plainHttpProblem } from '../../src/plainHttp';

// Reviewer 100 (PT-138): *.localhost counted as this computer. macOS sends it to loopback, but
// some Linux resolvers ask DNS, so a token sent over plain http could leave the machine.
describe('regression: a token over plain http to a *.localhost name', () => {
  it.each(['http://tracker.localhost:4100', 'http://a.b.localhost/'])(
    'is refused for %s',
    (url) => {
      expect(plainHttpProblem(url)).toBeDefined();
    },
  );

  it('still goes to localhost itself', () => {
    expect(plainHttpProblem('http://localhost:4100')).toBeUndefined();
  });
});

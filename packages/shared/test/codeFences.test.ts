import { describe, expect, it } from 'vitest';
import { codeFences } from '../src/logic/codeFences';

const fences = (...lines: string[]) =>
  codeFences(lines).map(({ start, end, marker, info }) => [start, end, marker, info]);

describe('codeFences', () => {
  it('closes a fence only on a bare one of the same character, at least as long', () => {
    expect(fences('````md', '```', '~~~~', '````ticket', '`````', 'after')).toEqual([
      [0, 4, '````', 'md'],
    ]);
  });

  it('takes up to three spaces before a fence, and none more', () => {
    expect(fences('   ~~~ sh', 'x', '   ~~~', '    ```', 'code', '    ```')).toEqual([
      [0, 2, '~~~', 'sh'],
    ]);
  });

  it('runs a fence that never closes to the end and finds nothing after it', () => {
    expect(fences('```', 'a', '````ticket', 'b')).toEqual([[0, -1, '```', '']]);
  });

  it('leaves a backtick line whose info holds a backtick as text', () => {
    expect(fences('``` a`b', '```js', '```')).toEqual([[1, 2, '```', 'js']]);
  });
});

import { describe, expect, it } from 'vitest';
import { parseDiff } from '../src/logic/diff';

const MODIFIED = [
  'diff --git a/src/a.ts b/src/a.ts',
  'index 1111111..2222222 100644',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1,3 +1,3 @@ export function a() {',
  ' const x = 1;',
  '-const y = 2;',
  '+const y = 3;',
  ' return x;',
  '@@ -10,2 +10,3 @@',
  ' end();',
  '+more();',
  ' }',
].join('\n');

const ADDED = [
  'diff --git a/new file.md b/new file.md',
  'new file mode 100644',
  'index 0000000..3333333',
  '--- /dev/null',
  '+++ b/new file.md',
  '@@ -0,0 +1,2 @@',
  '+# Title',
  '+--- not a header',
  '\\ No newline at end of file',
].join('\n');

describe('parseDiff', () => {
  it('reads files, hunks and numbered lines', () => {
    const [file] = parseDiff(`${MODIFIED}\n`);
    expect(file).toMatchObject({
      path: 'src/a.ts',
      oldPath: 'src/a.ts',
      status: 'modified',
      binary: false,
      additions: 2,
      deletions: 1,
    });
    expect(file?.hunks.map((hunk) => hunk.header)).toEqual([
      '@@ -1,3 +1,3 @@ export function a() {',
      '@@ -10,2 +10,3 @@',
    ]);
    expect(file?.hunks[0]?.lines).toEqual([
      { kind: 'context', text: 'const x = 1;', oldLine: 1, newLine: 1 },
      { kind: 'del', text: 'const y = 2;', oldLine: 2, newLine: null },
      { kind: 'add', text: 'const y = 3;', oldLine: null, newLine: 2 },
      { kind: 'context', text: 'return x;', oldLine: 3, newLine: 3 },
    ]);
    expect(file?.hunks[1]?.lines.map((line) => [line.oldLine, line.newLine])).toEqual([
      [10, 10],
      [null, 11],
      [11, 12],
    ]);
  });

  it('reads a new file with spaces in its name, and a line that looks like a header', () => {
    const files = parseDiff(`${MODIFIED}\n${ADDED}`);
    expect(files.map((file) => file.path)).toEqual(['src/a.ts', 'new file.md']);
    expect(files[1]).toMatchObject({ status: 'added', additions: 2, deletions: 0 });
    expect(files[1]?.hunks[0]?.lines.map((line) => line.text)).toEqual([
      '# Title',
      '--- not a header',
    ]);
  });

  it('reads deletions, renames and binary files', () => {
    const files = parseDiff(
      [
        'diff --git a/old.ts b/old.ts',
        'deleted file mode 100644',
        '--- a/old.ts',
        '+++ /dev/null',
        '@@ -1 +0,0 @@',
        '-gone',
        'diff --git a/from.ts b/to.ts',
        'similarity index 100%',
        'rename from from.ts',
        'rename to to.ts',
        'diff --git a/logo.png b/logo.png',
        'Binary files a/logo.png and b/logo.png differ',
      ].join('\n'),
    );
    expect(
      files.map(({ path, oldPath, status, binary }) => [path, oldPath, status, binary]),
    ).toEqual([
      ['old.ts', 'old.ts', 'deleted', false],
      ['to.ts', 'from.ts', 'renamed', false],
      ['logo.png', 'logo.png', 'modified', true],
    ]);
  });

  it('reads quoted paths with escapes and UTF-8 bytes', () => {
    const [file] = parseDiff(
      [
        'diff --git "a/caf\\303\\251 \\"x\\".txt" "b/caf\\303\\251 \\"x\\".txt"',
        '--- "a/caf\\303\\251 \\"x\\".txt"',
        '+++ "b/caf\\303\\251 \\"x\\".txt"',
        '@@ -1 +1 @@',
        '-a',
        '+b',
      ].join('\n'),
    );
    expect(file?.path).toBe('café "x".txt');
  });

  it('keeps what a cut diff has, and nothing before the first file', () => {
    const cut = MODIFIED.split('\n').slice(0, 7).join('\n');
    const [file] = parseDiff(`warning: something\n${cut}`);
    expect(file?.hunks[0]?.lines).toHaveLength(2);
    expect(parseDiff('')).toEqual([]);
    expect(parseDiff('not a diff')).toEqual([]);
  });

  it("gives each file a digest that changes with the file's change", () => {
    const [a] = parseDiff(MODIFIED);
    const [same] = parseDiff(MODIFIED);
    const [other] = parseDiff(MODIFIED.replace('more();', 'less();'));
    expect(a?.digest).toBe(same?.digest);
    expect(a?.digest).not.toBe(other?.digest);
    expect(a?.digest.length).toBeLessThanOrEqual(16);
  });
});

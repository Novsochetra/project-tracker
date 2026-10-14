import { describe, expect, it } from 'vitest';
import { capDiff, lineNote, maskDiff, prepareDiff } from '../src/logic/diff';

const fileOf = (lines: string[]) =>
  [
    'diff --git a/src/config.ts b/src/config.ts',
    '--- a/src/config.ts',
    '+++ b/src/config.ts',
    '@@ -1,2 +1,2 @@',
    ...lines,
  ].join('\n');

describe('maskDiff', () => {
  it('masks secrets in added, removed and kept lines by the steps rules', () => {
    const masked = maskDiff(
      fileOf([
        '-GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789',
        '+API_KEY=sk-ant-api03-abcdefghijklmnop',
        ' password: "hunter2hunter2"',
      ]),
    );
    expect(masked).not.toContain('ghp_abc');
    expect(masked).not.toContain('sk-ant-api03');
    expect(masked).not.toContain('hunter2');
    expect(masked).toContain('-GITHUB_TOKEN=***');
    expect(masked.split('\n')).toHaveLength(7);
  });

  it("masks a private key's lines after its BEGIN line, up to its END", () => {
    const body = 'MIIEowIBAAKCAQEAu1SU1LfVLPHCozMxH2Mo4lgOEePzNm0tRgeLezV6ffAt0gun';
    const masked = maskDiff(
      fileOf([
        '+-----BEGIN RSA PRIVATE KEY-----',
        `+${body}`,
        `+${body}`,
        '+-----END RSA PRIVATE KEY-----',
        `+${body}`,
      ]),
    );
    expect(masked.split('\n').filter((line) => line === '+***')).toHaveLength(2);
    expect(masked.split('\n').at(-1)).toBe(`+${body}`);
  });

  it('leaves file names and hunk lines as they are', () => {
    const text = fileOf(['+const x = 1;']);
    expect(maskDiff(text)).toBe(text);
  });
});

describe('capDiff and prepareDiff', () => {
  it('cuts at the end of a whole line and says so', () => {
    expect(capDiff('a\nbb\nccc\n', 6)).toEqual({ diff: 'a\nbb\n', cut: true });
    expect(capDiff('a\nbb\n', 6)).toEqual({ diff: 'a\nbb\n', cut: false });
    expect(capDiff('abcdefgh', 4)).toEqual({ diff: '', cut: true });
  });

  it('masks, then cuts to the cap, never showing part of a masked line', () => {
    const line = '+TOKEN=abcdefghijklmnopqrstuvwxyz123456\n';
    const raw = fileOf([]) + '\n' + line.repeat(10);
    const { diff, cut } = prepareDiff(raw, false, 200);
    expect(cut).toBe(true);
    expect(diff.length).toBeLessThanOrEqual(200);
    expect(diff).not.toContain('abcdef');
    expect(diff.endsWith('+TOKEN=***\n')).toBe(true);
  });

  it('keeps a text that was read in part marked as cut, without its part of a line', () => {
    expect(prepareDiff('diff --git a/x b/x\n+ghp_abc', true)).toEqual({
      diff: 'diff --git a/x b/x\n',
      cut: true,
    });
    expect(prepareDiff('diff --git a/x b/x\n').cut).toBe(false);
  });

  it('reads a long text only to twice the cap before masking', () => {
    const raw = '+x\n'.repeat(1000);
    expect(prepareDiff(raw, false, 100).diff.length).toBeLessThanOrEqual(100);
  });
});

describe('lineNote', () => {
  it('names the file and line, and says when the line was before the change', () => {
    expect(lineNote({ path: 'src/a.ts', side: 'new', line: 12 }, 'Rename this.')).toBe(
      'On src/a.ts line 12: Rename this.',
    );
    expect(lineNote({ path: 'src/a.ts', side: 'old', line: 3 }, 'Keep this.')).toBe(
      'On src/a.ts line 3 before the change: Keep this.',
    );
  });
});

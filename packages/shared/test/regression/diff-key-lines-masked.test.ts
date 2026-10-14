import { describe, expect, it } from 'vitest';
import { maskDiff } from '../../src/logic/diff';

const BODY = 'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW';

const fileOf = (path: string, lines: string[]) =>
  [
    `diff --git a/${path} b/${path}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${path}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((line) => `+${line}`),
  ].join('\n');

const notesFile = (lines: string[]) => fileOf('docs/notes.md', lines);

describe("a private key's lines in a diff (PT-229 review)", () => {
  it('are masked when the key was saved with CRLF line ends', () => {
    const masked = maskDiff(
      notesFile([
        '-----BEGIN OPENSSH PRIVATE KEY-----\r',
        `${BODY}\r`,
        'AAAAB3Nza\r',
        '-----END OPENSSH PRIVATE KEY-----\r',
      ]),
    );
    expect(masked).not.toContain(BODY);
    expect(masked).not.toContain('AAAAB3Nza');
    expect(masked).toContain('+-----END OPENSSH PRIVATE KEY-----\r');
  });

  it('are masked in a PGP private key block, headers and checksum too', () => {
    const masked = maskDiff(
      notesFile([
        '-----BEGIN PGP PRIVATE KEY BLOCK-----',
        'Comment: my key',
        '',
        BODY,
        '=Xy9z',
        '-----END PGP PRIVATE KEY BLOCK-----',
      ]),
    );
    expect(masked).not.toContain(BODY);
    expect(masked).not.toContain('my key');
    expect(masked).not.toContain('=Xy9z');
  });
});

describe('secret files in a diff (PT-229 review)', () => {
  it('are masked whole, in shapes no line rule knows', () => {
    const lines = ['machine example.com login dara password hunter2'];
    for (const path of ['.netrc', 'config/.env.local', 'certs/server.pem', '.ssh/id_ed25519']) {
      const masked = maskDiff(fileOf(path, lines));
      expect(masked, path).not.toContain('hunter2');
      expect(masked, path).toContain(`+++ b/${path}`);
    }
  });

  it('mask credentials and Discord webhooks in other files', () => {
    const masked = maskDiff(
      notesFile([
        'MY_CREDENTIAL=abc123def456',
        'https://discord.com/api/webhooks/123456/abcdefSECRET',
      ]),
    );
    expect(masked).not.toContain('abc123def456');
    expect(masked).not.toContain('abcdefSECRET');
  });
});

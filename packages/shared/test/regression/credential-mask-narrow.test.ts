import { describe, expect, it } from 'vitest';
import { maskDiff } from '../../src/logic/diff';
import { maskSecrets } from '../../src/logic/runSteps/secrets';

const fileOf = (path: string, lines: string[]) =>
  [
    `diff --git a/${path} b/${path}`,
    '--- /dev/null',
    `+++ b/${path}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((line) => `+${line}`),
  ].join('\n');

describe('credential names in a diff (PT-229 review, PT-237)', () => {
  it('leave harmless code readable', () => {
    for (const line of [
      "fetch(url, { credentials: 'include' });",
      'const init = { "credentials": "same-origin" };',
      'credential_id: 42',
      'const credentialId = 1234567890123;',
    ]) {
      expect(maskSecrets(line), line).toBe(line);
    }
  });

  it('still mask a value given to a credential-like name', () => {
    for (const [line, secret] of [
      ['MY_CREDENTIAL=abc123def456', 'abc123def456'],
      ["credentials: 'hunter2hunter2'", 'hunter2hunter2'],
      ['const dbCredential = "s3cr3t-value"', 's3cr3t-value'],
      ['{ "credentials": "abc123def456" }', 'abc123def456'],
    ] as const) {
      expect(maskSecrets(line), line).not.toContain(secret);
    }
  });
});

describe('example env files in a diff (PT-229 review, PT-237)', () => {
  it('are read line by line, not masked whole', () => {
    for (const path of ['.env.example', 'web/.env.sample', '.env.template']) {
      const masked = maskDiff(
        fileOf(path, ['PORT=4100', 'API_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123']),
      );
      expect(masked, path).toContain('+PORT=4100');
      expect(masked, path).not.toContain('ghp_');
    }
  });

  it('leave a real env file masked whole', () => {
    expect(maskDiff(fileOf('.env.local', ['PORT=4100']))).not.toContain('PORT=4100');
  });
});

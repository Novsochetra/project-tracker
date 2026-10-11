import { describe, expect, it } from 'vitest';
import { permissionLabel } from '../../src/logic/runRequests/permissionLabel';
import { maskSecrets } from '../../src/logic/runSteps/secrets';

// A Write or Edit label carries the file's text to the tracker, and the rules, made for commands,
// showed the usual config shapes in clear: YAML, TOML, INI, code, XML and a private key's body
// (PT-171 second review).
const written = (content: string) =>
  permissionLabel('Write', { file_path: '/r/.env', content }, '/r').label.split('\n').slice(1);

const KEY_BODY = [
  'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW',
  'QyNTUxOQAAACDw2xJ0b2tlbiBib2R5IGxpbmUgdHdvIG9mIHRoZSBwcml2YXRlIGtleQ==',
];

describe('a secret in a config file Claude writes', () => {
  it('is masked in YAML, TOML, INI and code', () => {
    expect(
      written(
        [
          'password: hunter2xx',
          '  api_key: abc123def456',
          '- token: abc123def456',
          'api_key = "abc123def456"',
          'password = hunter2xx',
          'aws_secret_access_key = wJalrXUtnFEMIK7MDENGbPxRfiCYEXAMPLEKEY',
          "const apiKey = 'abc123def456';",
          '"client_secret" = "abc123def456"',
        ].join('\n'),
      ),
    ).toEqual([
      '+ password: ***',
      '+   api_key: ***',
      '+ - token: ***',
      '+ api_key = "***"',
      '+ password = ***',
      '+ aws_secret_access_key = ***',
      "+ const apiKey = '***';",
      '+ "client_secret" = "***"',
    ]);
  });

  it('is masked between XML tags of its name', () => {
    expect(written('<password>hunter2xx</password>\n<apiKey>abc123</apiKey>')).toEqual([
      '+ <password>***</password>',
      '+ <apiKey>***</apiKey>',
    ]);
  });

  it("masks a private key's body, line by line", () => {
    const key = [
      '-----BEGIN OPENSSH PRIVATE KEY-----',
      ...KEY_BODY,
      '-----END OPENSSH PRIVATE KEY-----',
    ].join('\n');
    expect(written(key)).toEqual([
      '+ -----BEGIN OPENSSH PRIVATE KEY-----',
      '+ ***',
      '+ ***',
      '+ -----END OPENSSH PRIVATE KEY-----',
    ]);
    expect(maskSecrets(key)).not.toContain(KEY_BODY[0]);
  });

  it('keeps prose, references and code that only names a secret', () => {
    const kept = [
      'password: required',
      'token = os.environ["TOKEN"]',
      'password = get_password()',
      'api_key: $API_KEY',
      'keyboard = qwerty12345',
      '-----BEGIN PUBLIC KEY-----',
      'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLPHCozMxH2Mo',
    ];
    expect(written(kept.join('\n'))).toEqual(kept.map((line) => `+ ${line}`));
  });
});

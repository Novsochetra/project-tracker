import { describe, expect, it } from 'vitest';
import { secretName } from '../../src/logic/runSteps/secretNames';
import { maskSecrets } from '../../src/logic/runSteps/secrets';

type Cases = readonly (readonly [string, string])[];

const masks = (cases: Cases) =>
  it.each(cases)('%s', (text, masked) => {
    expect(maskSecrets(text)).toBe(masked);
  });

const keeps = (texts: readonly string[]) =>
  it.each(texts)('keeps %s', (text) => {
    expect(maskSecrets(text)).toBe(text);
  });

describe('maskSecrets', () => {
  describe('quoted header', () => {
    masks([
      ['curl -H "Authorization: Bearer abc.def" x', 'curl -H "Authorization: ***" x'],
      ["curl -H 'X-Api-Key: abc123' x", "curl -H 'X-Api-Key: ***' x"],
      ['curl -H "Cookie: session=abc" x', 'curl -H "Cookie: ***" x'],
      ['curl -H "PRIVATE-TOKEN: glpat-xyz" x', 'curl -H "PRIVATE-TOKEN: ***" x'],
    ]);
    keeps(['curl -H "X-Requested-With: XMLHttpRequest" x', 'git log --format="%an <%ae>"']);
  });

  describe('authorization scheme', () => {
    masks([
      ['Authorization: Basic dXNlcjpwYXNz', 'Authorization: Basic ***'],
      ['http GET x Authorization:"Basic dXNlcjpwYXNz"', 'http GET x Authorization:***'],
      ['curl -H Authorization:\\ Basic\\ dXNlcjpwYXNz x', 'curl -H Authorization:\\ Basic\\ *** x'],
    ]);
    keeps(['Use Authorization: Basic auth here']);
  });

  describe('bare header', () => {
    masks([['http GET x X-API-Key:abc123', 'http GET x X-API-Key:***']]);
    keeps(['git log --pretty=format:%H', 'scp f.txt user@host:/tmp']);
  });

  describe('bearer', () => {
    masks([['http GET x bearer sk1234', 'http GET x bearer ***']]);
    keeps(['I used a Bearer token in the header.', 'curl -H Bearer $TOKEN x']);
  });

  describe('json key', () => {
    masks([
      ['curl -d \'{"password":"hunter2"}\' x', 'curl -d \'{"password":"***"}\' x'],
      ['curl -d \'{"api_key": "abc"}\' x', 'curl -d \'{"api_key": "***"}\' x'],
      ['curl -d "{\\"password\\":\\"hunter2\\"}" x', 'curl -d "{\\"password\\":\\"***\\"}" x'],
    ]);
    keeps(['{"name": "x", "keyboard": "us"}']);
  });

  describe('user password', () => {
    masks([
      ['curl -u alice:s3cret https://x', 'curl -u alice:*** https://x'],
      ['curl --user alice:s3cret https://x', 'curl --user alice:*** https://x'],
      ['curl -u "alice:s3cret" https://x', 'curl -u "alice:***" https://x'],
      ["curl -u 'alice:s3cret' https://x", "curl -u 'alice:***' https://x"],
    ]);
    keeps(['docker run -u 1000:1000 node:22', 'curl -u alice https://x', 'ps -u root']);
  });

  describe('address password and address token', () => {
    masks([
      ['git clone https://dara:s3cret@github.com/a/b', 'git clone https://dara:***@github.com/a/b'],
      ['git clone https://ghp_abc123@github.com/a/b', 'git clone https://***@github.com/a/b'],
      ['psql "postgresql://u:pw123@host:5432/db"', 'psql "postgresql://u:***@host:5432/db"'],
    ]);
    keeps(['ssh deploy@10.0.0.1', 'git remote set-url origin git@github.com:a/b.git']);
  });

  describe('flag', () => {
    masks([
      ['tracker login --token trk_abc123 --url x', 'tracker login --token *** --url x'],
      ['vercel --token=abc', 'vercel --token=***'],
      ['docker login -u me --password hunter2', 'docker login -u me --password ***'],
      ['stripe --api-key "two words" now', 'stripe --api-key *** now'],
    ]);
    keeps([
      'gh auth login --with-token < token.txt',
      'jq --sort-keys . f.json',
      'Pass --token to the CLI and it logs in.',
      'The --password flag is deprecated; use --password-stdin.',
      'npm test -- --key-path=x',
      'npm run build -- --bypass-cache=true',
    ]);
  });

  describe('name=value', () => {
    masks([
      ['export GITHUB_TOKEN=ghp_abc && gh pr list', 'export GITHUB_TOKEN=*** && gh pr list'],
      ["AWS_SECRET_ACCESS_KEY='a b' aws s3 ls", 'AWS_SECRET_ACCESS_KEY=*** aws s3 ls'],
      ['PGPASSWORD=hunter2 psql', 'PGPASSWORD=*** psql'],
      ['curl "https://x/?token=abc&q=1"', 'curl "https://x/?token=***&q=1"'],
      ['kubectl --from-literal=password=hunter2', 'kubectl --from-literal=password=***'],
      ['TOKEN=abc; ./deploy.sh | tee log', 'TOKEN=***; ./deploy.sh | tee log'],
      ['Set `GITHUB_TOKEN=ghp_x` first.', 'Set `GITHUB_TOKEN=***` first.'],
    ]);
    keeps([
      'TOKEN=$(gh auth token) ./x',
      'GITHUB_TOKEN=`gh auth token` ./x',
      'Add `key={item.id}` to each <li>.',
      'KEYBOARD_LAYOUT=us MONKEY=1 BYPASS_CACHE=1 ./x',
    ]);
  });

  describe('known prefix', () => {
    masks([
      ['echo ghp_abcdef0123 | gh auth login', 'echo *** | gh auth login'],
      ['tracker login trk_q2Wj8xYbN0aPz7vL1cKdF3sE', 'tracker login ***'],
      ['echo github_pat_11AB_cd | x', 'echo *** | x'],
      ['echo sk-ant-api03-abc | claude', 'echo *** | claude'],
      ['echo sk-proj-abcdefghijklmnopqrstuv | x', 'echo *** | x'],
      ['stripe get sk_live_abc', 'stripe get ***'],
      ['slack xoxb-123-abc and xoxp-9', 'slack *** and ***'],
      ['aws --profile AKIAIOSFODNN7EXAMPLE', 'aws --profile ***'],
      [
        'curl https://hooks.slack.com/services/T0/B0/XYZ',
        'curl https://hooks.slack.com/services/***',
      ],
    ]);
    keeps(['npm i scikit-learn risk-free sk-learn']);
  });

  describe('what stays on purpose', () => {
    keeps(['mysql -u root -p hunter2', 'redis-cli -a hunter2', 'mkdir -p a/b', 'npm run verify']);
    keeps([
      'Read src/auth/tokenStore.ts',
      'grep -r "password" src',
      'jq ".items | sort_by(.key)" f',
    ]);
  });

  describe('a long secret, masked whole', () => {
    const token = 'IQoJb3JpZ2luX2Vj'.repeat(60);
    masks([
      [`export AWS_SESSION_TOKEN=${token} && ls`, 'export AWS_SESSION_TOKEN=*** && ls'],
      [`export TOKEN="${token}"`, 'export TOKEN=***'],
      [`curl -H "Authorization: Bearer ${token}" x`, 'curl -H "Authorization: ***" x'],
      [`curl -H Authorization:\\ Bearer\\ ${token} x`, 'curl -H Authorization:\\ Bearer\\ *** x'],
      [`vercel --token ${token}`, 'vercel --token ***'],
      [`curl -d '{"id_token":"${token}"}' x`, `curl -d '{"id_token":"***"}' x`],
      [`psql postgres://u:${token}@h/db`, 'psql postgres://u:***@h/db'],
      [`echo ghp_${token}`, 'echo ***'],
      [`export TOKEN="${token}`, 'export TOKEN=***'],
    ]);
  });

  it.each([
    ['key-key', 'key-'.repeat(5000)],
    ['kebab list', Array.from({ length: 2600 }, (_, i) => `item${i}`).join('-')],
    ['kebab keys', Array.from({ length: 1000 }, (_, i) => `cache-key${i}`).join('-')],
    ['open quote', `"${'a-'.repeat(10_000)}`],
    ['headers', '"a:'.repeat(7000)],
    ['addresses', '//a:'.repeat(5000)],
    ['assignments', 'a=b'.repeat(7000)],
    ['key assignments', 'x key='.repeat(3500)],
    ['user flags', ' -u a:'.repeat(3500)],
    ['flags', ' --x'.repeat(5000)],
    ['bearers', 'bearer '.repeat(3000)],
  ])('masks 20 KB of %s in well under a second', (_name, text) => {
    // Takes about a millisecond; the slow regex took seconds to minutes, and a GC pause in a
    // parallel run must not fail it.
    const started = performance.now();
    maskSecrets(text);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe('secretName', () => {
  it('reads a name by its words', () => {
    for (const name of [
      'GPG_PASSPHRASE',
      'APISECRET',
      'CLIENTSECRET',
      'clientsecret',
      'SECRETKEY',
      'ACCESSKEY',
      'AUTHKEY',
      'GITHUB_TOKEN',
      'PGPASSWORD',
      '_authToken',
      'SECRET_KEY_BASE',
      'X-Api-Key',
      'apiKey',
      'PASS',
      'Cookie',
    ]) {
      expect(secretName(name), name).toBe(true);
    }
    for (const name of [
      'MONKEY',
      'KEYBOARD_LAYOUT',
      'BYPASS_CACHE',
      'key-path',
      'X-Requested-With',
      'AWS_ACCESS_KEY_ID',
    ]) {
      expect(secretName(name), name).toBe(false);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { maskSecrets } from '../../src/logic/runSteps/secrets';

describe('maskSecrets', () => {
  it.each([
    [
      'curl -H "Authorization: Bearer abc.def" https://x.dev',
      'curl -H "Authorization: ***" https://x.dev',
    ],
    ["curl -H 'X-Api-Key: abc123' x", "curl -H 'X-Api-Key: ***' x"],
    ['curl -H "Cookie: session=abc" x', 'curl -H "Cookie: ***" x'],
    ['curl -H "PRIVATE-TOKEN: glpat-xyz" x', 'curl -H "PRIVATE-TOKEN: ***" x'],
    ['http GET x bearer sk1234', 'http GET x bearer ***'],
    ['curl -u alice:s3cret https://x', 'curl -u alice:*** https://x'],
    ['curl --user alice:s3cret https://x', 'curl --user alice:*** https://x'],
    ['git clone https://dara:s3cret@github.com/a/b', 'git clone https://dara:***@github.com/a/b'],
    ['git clone https://ghp_abc123@github.com/a/b', 'git clone https://***@github.com/a/b'],
    ['tracker login --token trk_abc --url x', 'tracker login --token *** --url x'],
    ['docker login -u me --password=hunter2', 'docker login -u me --password=***'],
    ['stripe --api-key "two words" now', 'stripe --api-key *** now'],
    ['export GITHUB_TOKEN=ghp_abc && gh pr list', 'export GITHUB_TOKEN=*** && gh pr list'],
    ["AWS_SECRET_ACCESS_KEY='a b' aws s3 ls", 'AWS_SECRET_ACCESS_KEY=*** aws s3 ls'],
    ['env PASS=hunter2 ./x', 'env PASS=*** ./x'],
    ['curl "https://x/?token=abc&q=1"', 'curl "https://x/?token=***&q=1"'],
    ['echo ghp_abcdef0123 | gh auth login', 'echo *** | gh auth login'],
    ['echo github_pat_11AB_cd | x', 'echo *** | x'],
    ['echo sk-ant-api03-abc | claude', 'echo *** | claude'],
    ['stripe get sk_live_abc', 'stripe get ***'],
    ['slack xoxb-123-abc and xoxp-9', 'slack *** and ***'],
    ['aws --profile AKIAIOSFODNN7EXAMPLE', 'aws --profile ***'],
    [
      'curl https://hooks.slack.com/services/T0/B0/XYZ',
      'curl https://hooks.slack.com/services/***',
    ],
  ])('masks %s', (text, masked) => {
    expect(maskSecrets(text)).toBe(masked);
  });

  it('never takes the next shell word or symbol as the value', () => {
    expect(maskSecrets('gh auth login --with-token < token.txt')).toBe(
      'gh auth login --with-token < token.txt',
    );
    expect(maskSecrets('jq --sort-keys . f.json')).toBe('jq --sort-keys . f.json');
    expect(maskSecrets('TOKEN=abc; ./deploy.sh | tee log')).toBe(
      'TOKEN=***; ./deploy.sh | tee log',
    );
    expect(maskSecrets('Set `GITHUB_TOKEN=ghp_x` first.')).toBe('Set `GITHUB_TOKEN=***` first.');
  });

  it('leaves -p and -a alone, which other commands use for other things', () => {
    for (const text of ['mysql -u root -p hunter2', 'redis-cli -a hunter2', 'mkdir -p a/b']) {
      expect(maskSecrets(text)).toBe(text);
    }
  });

  it('leaves a command without secrets as it is', () => {
    const plain = ['npm run verify', 'git log --pretty=format:%H', 'grep -r "password" src', 'ls'];
    for (const text of [...plain, 'Read src/keys.ts', 'ssh git@github.com']) {
      expect(maskSecrets(text)).toBe(text);
    }
  });
});

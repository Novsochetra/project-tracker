import { describe, expect, it } from 'vitest';
import { maskSecrets } from '../../src/logic/runSteps/secrets';

describe('maskSecrets', () => {
  it.each([
    [
      'curl -H "Authorization: Bearer abc.def" https://x.dev',
      'curl -H "Authorization: Bearer ***" https://x.dev',
    ],
    ["curl -H 'authorization: token ghp_1' x", "curl -H 'authorization: token ***' x"],
    ['http GET x Bearer:no bearer sk-123', 'http GET x Bearer:no bearer ***'],
    ['tracker login --token trk_abc --url x', 'tracker login --token *** --url x'],
    ['psql --password=hunter2 -h db', 'psql --password=*** -h db'],
    ['deploy --api-key "two words" now', 'deploy --api-key *** now'],
    ['export GITHUB_TOKEN=ghp_abc && gh pr list', 'export GITHUB_TOKEN=*** && gh pr list'],
    ["AWS_SECRET_ACCESS_KEY='a b' aws s3 ls", 'AWS_SECRET_ACCESS_KEY=*** aws s3 ls'],
    ['db_password=x npm start', 'db_password=*** npm start'],
    ['git clone https://dara:s3cret@github.com/a/b', 'git clone https://dara:***@github.com/a/b'],
  ])('masks %s', (text, masked) => {
    expect(maskSecrets(text)).toBe(masked);
  });

  it('leaves a command without secrets as it is', () => {
    for (const text of ['npm run verify', 'git log --oneline -5', 'Read src/keys.ts', 'ls -la']) {
      expect(maskSecrets(text)).toBe(text);
    }
  });
});

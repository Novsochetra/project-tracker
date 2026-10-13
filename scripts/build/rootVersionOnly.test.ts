import { describe, expect, it } from 'vitest';
import { versionOnlyJson } from './rootVersionOnly';

describe('versionOnlyJson', () => {
  it('keeps only the version of a package.json', () => {
    const pkg = JSON.stringify({ name: 'app', version: '1.2.3', scripts: { dev: 'x' } });
    expect(JSON.parse(versionOnlyJson(pkg))).toEqual({ version: '1.2.3' });
  });

  it('says so when there is no version', () => {
    expect(() => versionOnlyJson('{"name":"app"}')).toThrow('package.json has no version.');
  });
});

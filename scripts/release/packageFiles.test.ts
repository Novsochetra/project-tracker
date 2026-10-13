import { describe, expect, it } from 'vitest';
import { readVersion, setLockVersion, setPackageVersion } from './packageFiles';

const pkg = `${JSON.stringify({ name: 'app', version: '1.0.0', private: true }, null, 2)}\n`;

describe('package.json', () => {
  it('reads and replaces the version, keeping the layout', () => {
    expect(readVersion(pkg)).toBe('1.0.0');
    expect(setPackageVersion(pkg, '1.1.0')).toBe(pkg.replace('1.0.0', '1.1.0'));
  });

  it('says so when there is no version', () => {
    expect(() => readVersion('{"name":"app"}')).toThrow('package.json has no version.');
  });
});

describe('package-lock.json', () => {
  it('sets both root versions right after the name, as npm does', () => {
    const lock = { name: 'app', lockfileVersion: 3, packages: { '': { name: 'app' }, a: {} } };
    const updated = JSON.parse(setLockVersion(JSON.stringify(lock), '1.1.0')) as unknown;
    expect(JSON.stringify(updated)).toBe(
      JSON.stringify({
        name: 'app',
        version: '1.1.0',
        lockfileVersion: 3,
        packages: { '': { name: 'app', version: '1.1.0' }, a: {} },
      }),
    );
  });
});

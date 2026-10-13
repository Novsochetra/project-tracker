import { describe, expect, it } from 'vitest';
import { bumpVersion, isReleasePart } from './bump';

describe('bumpVersion', () => {
  it('bumps one part and resets the smaller ones', () => {
    expect(bumpVersion('1.4.2', 'patch')).toBe('1.4.3');
    expect(bumpVersion('1.4.2', 'minor')).toBe('1.5.0');
    expect(bumpVersion('1.4.2', 'major')).toBe('2.0.0');
    expect(bumpVersion('0.9.9', 'patch')).toBe('0.9.10');
  });

  it('refuses a version that is not plain semver', () => {
    expect(() => bumpVersion('1.0', 'patch')).toThrow('"1.0" is not a version like 1.2.3.');
    expect(() => bumpVersion('1.0.0-beta.1', 'patch')).toThrow();
  });
});

describe('isReleasePart', () => {
  it('knows patch, minor and major only', () => {
    expect(['patch', 'minor', 'major'].every((part) => isReleasePart(part))).toBe(true);
    expect(isReleasePart('1.2.3')).toBe(false);
    expect(isReleasePart(undefined)).toBe(false);
  });
});

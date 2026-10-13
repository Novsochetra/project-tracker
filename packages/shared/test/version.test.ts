import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../src/logic/appVersion';
import { shortCommit, versionLabel } from '../src/logic/version';

describe('APP_VERSION', () => {
  it('is the root package.json version', () => {
    const root = new URL('../../../package.json', import.meta.url);
    const { version } = JSON.parse(readFileSync(root, 'utf8')) as { version: string };
    expect(APP_VERSION).toBe(version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('shortCommit', () => {
  it('keeps the first seven characters of a git sha', () => {
    expect(shortCommit('A1B2C3D4E5F60718293a4b5c6d7e8f9012345678')).toBe('a1b2c3d');
    expect(shortCommit(' a1b2c3d\n')).toBe('a1b2c3d');
  });

  it('gives nothing for a missing or odd value', () => {
    expect(shortCommit(undefined)).toBeNull();
    expect(shortCommit('')).toBeNull();
    expect(shortCommit('main')).toBeNull();
    expect(shortCommit('a1b2c3')).toBeNull();
  });
});

describe('versionLabel', () => {
  it('adds the commit when the build knows it', () => {
    expect(versionLabel('1.2.3', 'a1b2c3d')).toBe('v1.2.3 · a1b2c3d');
    expect(versionLabel('1.2.3', null)).toBe('v1.2.3');
  });
});

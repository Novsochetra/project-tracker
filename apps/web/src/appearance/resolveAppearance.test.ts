import { describe, expect, it } from 'vitest';
import { resolveAppearance } from './resolveAppearance';

describe('resolveAppearance', () => {
  it('follows the system for System', () => {
    expect(resolveAppearance('system', true)).toBe('dark');
    expect(resolveAppearance('system', false)).toBe('light');
  });

  it('keeps Light or Dark whatever the system is', () => {
    expect(resolveAppearance('light', true)).toBe('light');
    expect(resolveAppearance('dark', false)).toBe('dark');
  });
});

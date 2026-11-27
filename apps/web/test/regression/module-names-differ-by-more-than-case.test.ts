import { readdirSync } from 'node:fs';
import { join, parse } from 'node:path';
import { describe, expect, it } from 'vitest';

// ProjectRows.tsx sat beside projectRows.ts (PT-266). On a Mac's case-blind disk Vite resolved
// './ProjectRows' to the .ts file, so the phone Projects list threw and the dev app stayed blank.

const SOURCE = join(import.meta.dirname, '../../src');
const MODULE = /\.(ts|tsx)$/;

function clashesIn(folder: string): string[] {
  const entries = readdirSync(folder, { withFileTypes: true });
  const byName = new Map<string, string[]>();

  for (const entry of entries) {
    if (!entry.isFile() || !MODULE.test(entry.name) || entry.name.includes('.test.')) continue;

    const key = parse(entry.name).name.toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), entry.name]);
  }

  const here = [...byName.values()]
    .filter((names) => names.length > 1)
    .map((names) => names.join(' + '));
  const below = entries
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => clashesIn(join(folder, entry.name)));

  return [...here, ...below];
}

describe('regression: no two web modules in one folder differ only by case or extension', () => {
  it('finds none', () => {
    expect(clashesIn(SOURCE)).toEqual([]);
  });
});

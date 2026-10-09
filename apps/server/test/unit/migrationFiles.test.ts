import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS } from '../../src/db/migrations';

const FOLDER = fileURLToPath(new URL('../../src/db/migrations/', import.meta.url));

const files = readdirSync(FOLDER)
  .filter((file) => file !== 'index.ts')
  .map((file) => file.replace(/\.ts$/, ''))
  .sort();

const names = Object.keys(MIGRATIONS).sort();

describe('the migrations folder', () => {
  it('registers every file in migrations/index.ts under its own name', async () => {
    expect(names).toEqual(files);
    for (const name of names) {
      const module: unknown = await import(`../../src/db/migrations/${name}.ts`);
      expect(MIGRATIONS[name], name).toBe(module);
    }
  });

  it('numbers them 0001 upwards with no gap or repeat, each a four-digit number and snake_case', () => {
    for (const name of names) expect(name).toMatch(/^\d{4}_[a-z0-9]+(_[a-z0-9]+)*$/);
    expect(names.map((name) => Number(name.slice(0, 4)))).toEqual(
      names.map((_, index) => index + 1),
    );
  });

  it('gives every migration an up() and a down()', () => {
    for (const name of names) {
      expect(typeof MIGRATIONS[name]?.up, name).toBe('function');
      expect(typeof MIGRATIONS[name]?.down, name).toBe('function');
    }
  });
});

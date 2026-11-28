import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { systemDarkFallback, withSystemDarkFallback } from './systemDarkFallback';

const WEB = join(import.meta.dirname, '../..');
const TOKENS = readFileSync(join(WEB, 'src/design/tokens.css'), 'utf8');

const declarations = (block: string) =>
  [
    ...block.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+|color-scheme)\s*:\s*([^;]+);/g),
  ].map((match) => `${match[1]}: ${match[2]!.trim()}`);

const ruleBody = (css: string, selector: RegExp) => selector.exec(css)?.[1] ?? '';

describe('withSystemDarkFallback', () => {
  const built = withSystemDarkFallback(TOKENS);
  const dark = declarations(ruleBody(TOKENS, /:root\[data-appearance='dark'\]\s*\{([^}]*)\}/));
  const fallback = declarations(
    ruleBody(
      built,
      /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-appearance\]\) \{([^}]*)\}/,
    ),
  );

  it('repeats every dark declaration for a page no script has marked', () => {
    expect(dark.length).toBeGreaterThan(50);
    expect(fallback).toEqual(dark);
  });

  it('keeps the stylesheet as it was before the fallback', () => {
    expect(built.startsWith(TOKENS)).toBe(true);
  });

  it('refuses a stylesheet without the dark rule', () => {
    expect(() => withSystemDarkFallback(':root { --ink: #000; }')).toThrow(/no :root/);
  });
});

describe('systemDarkFallback', () => {
  const transform = systemDarkFallback().transform as (code: string, id: string) => unknown;

  it('changes only tokens.css', () => {
    expect(transform(TOKENS, `${WEB}/src/design/tokens.css?direct`)).toContain(
      ':root:not([data-appearance])',
    );
    expect(transform('a {}', `${WEB}/src/design/base.css`)).toBeNull();
  });

  it('runs in the app’s build', () => {
    expect(readFileSync(join(WEB, 'vite.config.ts'), 'utf8')).toContain('systemDarkFallback()');
  });
});

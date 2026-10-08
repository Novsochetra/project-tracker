import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '../../src');

const KEYWORDS = new Set([
  'none',
  'infinite',
  'both',
  'forwards',
  'backwards',
  'normal',
  'reverse',
  'alternate',
  'alternate-reverse',
  'running',
  'paused',
  'linear',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'step-start',
  'step-end',
  'initial',
  'inherit',
  'unset',
]);

interface Animation {
  file: string;
  name: string;
  isGlobal: boolean;
  fill: string | null;
}

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

const read = (file: string): string => readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const isModule = (file: string): boolean => file.endsWith('.module.css');

function animationsIn(file: string): Animation[] {
  const found: Animation[] = [];
  for (const match of read(file).matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/gi)) {
    const value = match[1] ?? '';
    const fill = /\b(both|forwards|backwards)\b/.exec(value)?.[1] ?? null;
    const globals = [...value.matchAll(/\bglobal\(\s*([\w-]+)\s*\)/g)].map((m) => m[1] ?? '');
    globals.forEach((name) => found.push({ file, name, isGlobal: true, fill }));
    const rest = value.replace(/\bglobal\([^)]*\)/g, ' ').replace(/[a-z-]+\([^)]*\)/gi, ' ');
    for (const token of rest.split(/[\s,]+/)) {
      if (token && !KEYWORDS.has(token) && !/^[\d.]/.test(token)) {
        found.push({ file, name: token, isGlobal: !isModule(file), fill });
      }
    }
  }
  return found;
}

const keyframesIn = (file: string): Set<string> =>
  new Set([...read(file).matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1] ?? ''));

const files = cssFiles(SRC);
const animations = files.flatMap(animationsIn);
const globalKeyframes = new Set(
  files.filter((f) => !isModule(f)).flatMap((f) => [...keyframesIn(f)]),
);
const where = (animation: Animation): string =>
  `${relative(SRC, animation.file)} uses "${animation.name}"`;

describe('regression: CSS animations only use keyframes they can see', () => {
  it('modules define their keyframes locally or reference real global ones with global(name)', () => {
    const problems = animations
      .filter(({ file, name, isGlobal }) =>
        isGlobal ? !globalKeyframes.has(name) : !keyframesIn(file).has(name),
      )
      .map(where);
    expect(problems).toEqual([]);
  });

  it('entrance animations leave no styles behind, so :active and stacking still work', () => {
    const problems = animations
      .filter(
        ({ name, fill }) => (fill === 'both' || fill === 'forwards') && !name.endsWith('-out'),
      )
      .map((animation) => `${where(animation)} with fill ${animation.fill}`);
    expect(problems).toEqual([]);
  });

  it('never keeps an end state through animation-fill-mode', () => {
    const problems = files.flatMap((file) =>
      [...read(file).matchAll(/animation-fill-mode\s*:\s*(both|forwards)/gi)].map(
        (match) => `${relative(SRC, file)} sets animation-fill-mode: ${match[1] ?? ''}`,
      ),
    );
    expect(problems).toEqual([]);
  });

  it('lets the shared rise animation leave no transform behind', () => {
    const rise = /\.rise\s*{([^}]*)}/.exec(read(join(SRC, 'design/motion.css')))?.[1] ?? '';
    expect(rise).toMatch(/backwards/);
  });
});

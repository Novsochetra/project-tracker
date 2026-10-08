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

function moduleFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return moduleFiles(path);
    return entry.name.endsWith('.module.css') ? [path] : [];
  });
}

function referencedKeyframes(css: string): string[] {
  const names: string[] = [];
  for (const match of css.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)) {
    const value = (match[1] ?? '')
      .replace(/\bglobal\([^)]*\)/g, ' ')
      .replace(/[a-z-]+\([^)]*\)/g, ' ');
    for (const token of value.split(/[\s,]+/)) {
      if (token && !KEYWORDS.has(token) && !/^[\d.]/.test(token)) names.push(token);
    }
  }
  return names;
}

const definedKeyframes = (css: string): Set<string> =>
  new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1] ?? ''));

describe('regression: CSS modules only animate with keyframes they can see', () => {
  it('defines every keyframe locally or references it with global(name)', () => {
    const problems: string[] = [];
    for (const file of moduleFiles(SRC)) {
      const css = readFileSync(file, 'utf8');
      const local = definedKeyframes(css);
      for (const name of referencedKeyframes(css)) {
        if (!local.has(name)) problems.push(`${relative(SRC, file)} uses "${name}"`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('lets the shared rise animation leave no transform behind', () => {
    const motion = readFileSync(join(SRC, 'design/motion.css'), 'utf8');
    const rise = /\.rise\s*{([^}]*)}/.exec(motion)?.[1] ?? '';
    expect(rise).toMatch(/backwards/);
    expect(rise).not.toMatch(/\bboth\b|\bforwards\b/);
  });
});

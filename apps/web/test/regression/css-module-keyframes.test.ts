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

const FILLS = new Set(['both', 'forwards', 'backwards']);

interface Sheet {
  file: string;
  css: string;
}

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

const sheet = (file: string, css: string): Sheet => ({
  file,
  css: css.replace(/\/\*[\s\S]*?\*\//g, ''),
});

const read = (path: string): Sheet => sheet(relative(SRC, path), readFileSync(path, 'utf8'));

const isModule = (file: string): boolean => file.endsWith('.module.css');

function withoutCalls(value: string): string {
  const next = value.replace(/[\w-]+\([^()]*\)/g, ' ');
  return next === value ? value : withoutCalls(next);
}

function listItems(value: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    if (value[index] === ')') depth -= 1;
    if (value[index] === ',' && depth === 0) {
      items.push(value.slice(start, index));
      start = index + 1;
    }
  }
  return [...items, value.slice(start)];
}

function animationsInItem(file: string, item: string): Animation[] {
  const words = withoutCalls(item).split(/\s+/).filter(Boolean);
  const fill = words.map((word) => word.toLowerCase()).find((word) => FILLS.has(word)) ?? null;
  const globals = [...item.matchAll(/\bglobal\(\s*([\w-]+)\s*\)/gi)].map((match) => match[1]!);
  const locals = words.filter(
    (word) => !KEYWORDS.has(word.toLowerCase()) && !/^[-+]?[\d.]/.test(word),
  );
  return [
    ...globals.map((name) => ({ file, name, isGlobal: true, fill })),
    ...locals.map((name) => ({ file, name, isGlobal: !isModule(file), fill })),
  ];
}

const animationsOf = ({ file, css }: Sheet): Animation[] =>
  [...css.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/gi)].flatMap((match) =>
    listItems(match[1]!).flatMap((item) => animationsInItem(file, item)),
  );

const keyframesOf = ({ css }: Sheet): string[] =>
  [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1]!);

const where = ({ file, name }: Animation): string => `${file} uses "${name}"`;

function unseenKeyframes(sheets: Sheet[]): string[] {
  const globals = sheets.filter(({ file }) => !isModule(file)).flatMap(keyframesOf);
  return sheets.flatMap((source) => {
    const locals = keyframesOf(source);
    return animationsOf(source)
      .filter(({ name, isGlobal }) => !(isGlobal ? globals : locals).includes(name))
      .map(where);
  });
}

const keepsEndState = ({ fill }: Animation): boolean => fill === 'both' || fill === 'forwards';

const isExit = ({ name }: Animation): boolean => name.endsWith('-out');

const entranceProblems = (sheets: Sheet[]): string[] =>
  sheets
    .flatMap(animationsOf)
    .filter((animation) => !isExit(animation) && keepsEndState(animation))
    .map((animation) => `${where(animation)} with fill ${animation.fill}`);

const exitProblems = (sheets: Sheet[]): string[] =>
  sheets
    .flatMap(animationsOf)
    .filter((animation) => isExit(animation) && !keepsEndState(animation))
    .map((animation) => `${where(animation)} without both or forwards`);

const fillModeProblems = (sheets: Sheet[]): string[] =>
  sheets.flatMap(({ file, css }) =>
    [...css.matchAll(/animation-fill-mode\s*:[^;}]*?\b(both|forwards)\b/gi)].map(
      (match) => `${file} sets animation-fill-mode: ${match[1]!}`,
    ),
  );

const appSheets = cssFiles(SRC).map(read);

describe('regression: CSS animations only use keyframes they can see', () => {
  it('modules define their keyframes locally or reference real global ones with global(name)', () => {
    expect(unseenKeyframes(appSheets)).toEqual([]);
  });

  it('entrance animations leave no styles behind, so :active and stacking still work', () => {
    expect(entranceProblems(appSheets)).toEqual([]);
  });

  // Exiting elements can outlive their animation; without a fill they flash back before unmounting.
  it('exit animations (named *-out) keep their end state', () => {
    expect(exitProblems(appSheets)).toEqual([]);
  });

  it('never keeps an end state through animation-fill-mode', () => {
    expect(fillModeProblems(appSheets)).toEqual([]);
  });

  it('lets the shared rise animation leave no transform behind', () => {
    const rise = /\.rise\s*{([^}]*)}/.exec(read(join(SRC, 'design/motion.css')).css)?.[1] ?? '';
    expect(rise).toMatch(/backwards/);
  });
});

describe('the CSS animation checks', () => {
  it('read the fill of each animation in a list', () => {
    const list = sheet('a.module.css', '.a { animation: a 1s backwards, b 1s both; }');
    expect(entranceProblems([list])).toEqual(['a.module.css uses "b" with fill both']);
  });

  it('flag exit animations that lose their end state', () => {
    const exits = sheet(
      'a.module.css',
      '.a { animation: a-out 1s both, b-out 1s forwards, c-out 1s backwards, d-out 1s; }',
    );
    expect(exitProblems([exits])).toEqual([
      'a.module.css uses "c-out" without both or forwards',
      'a.module.css uses "d-out" without both or forwards',
    ]);
  });

  it('read GLOBAL() and Global() like global()', () => {
    const motion = sheet('motion.css', '@keyframes fade-up {}');
    const typo = sheet(
      'a.module.css',
      '.a { animation: GLOBAL(fade-up) 1s, Global(fade-upp) 1s; }',
    );
    expect(unseenKeyframes([motion, typo])).toEqual(['a.module.css uses "fade-upp"']);
  });

  it('read every value of an animation-fill-mode list', () => {
    const longhands = sheet(
      'a.module.css',
      '.a { animation-fill-mode: backwards, BOTH; } .b { animation-fill-mode: backwards, backwards; }',
    );
    expect(fillModeProblems([longhands])).toEqual(['a.module.css sets animation-fill-mode: BOTH']);
  });

  it('do not take negative delays or nested var() fallbacks for keyframe names', () => {
    const values = sheet(
      'a.module.css',
      '.a { animation: a 1s -200ms var(--ease, var(--fallback)); } @keyframes a {}',
    );
    expect(unseenKeyframes([values])).toEqual([]);
  });
});

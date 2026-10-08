import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(import.meta.dirname, '../../src');
const PHONE_MEDIA = '@media (max-width: 767px)';

interface Rule {
  selector: string;
  body: string;
  media: string;
}

const readCss = (path: string): string =>
  readFileSync(join(SRC, path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function rulesOf(css: string): Rule[] {
  const rules: Rule[] = [];
  const preludes: string[] = [];
  let start = 0;
  for (let index = 0; index < css.length; index += 1) {
    if (css[index] !== '{' && css[index] !== '}') continue;
    if (css[index] === '{') preludes.push(css.slice(start, index).trim());
    else {
      const selector = preludes.pop() ?? '';
      const media = preludes.join(' ');
      if (!selector.startsWith('@')) rules.push({ selector, body: css.slice(start, index), media });
    }
    start = index + 1;
  }
  return rules;
}

const appliesOnPhones = (rule: Rule): boolean => rule.media === '' || rule.media === PHONE_MEDIA;

function declarations(rule: Rule): [string, string][] {
  return rule.body
    .split(';')
    .map((line) => line.split(':').map((part) => part.trim()))
    .flatMap(([name, ...value]) => (name ? [[name, value.join(':')] as [string, string]] : []));
}

function phoneTokens(): Map<string, string> {
  const rules = rulesOf(readCss('design/tokens.css'));
  const roots = rules.filter((rule) => rule.selector === ':root' && appliesOnPhones(rule));
  return new Map(roots.flatMap(declarations).filter(([name]) => name.startsWith('--')));
}

function resolve(value: string, tokens: Map<string, string>): string {
  const next = value.replace(
    /var\((--[\w-]+)\)/g,
    (_match, name: string) => tokens.get(name) ?? '',
  );
  return next === value ? value : resolve(next, tokens);
}

const styles = (selector: string, element: Element): boolean =>
  selector.split(',').some((part) => {
    const match = /^[a-z]*\.([\w-]+)$/.exec(part.trim());
    return match !== null && element.classList.contains(match[1]!);
  });

// A small cascade is enough: CSS modules style elements with plain class rules, so the last
// matching declaration at phone width wins. Values come back with tokens resolved.
export function phoneStyle(element: Element, cssModule: string): Map<string, string> {
  const tokens = phoneTokens();
  const style = new Map<string, string>();
  for (const rule of rulesOf(readCss(cssModule))) {
    if (!appliesOnPhones(rule) || !styles(rule.selector, element)) continue;
    for (const [name, value] of declarations(rule)) style.set(name, resolve(value, tokens));
  }
  return style;
}

export const pixels = (value: string | undefined): number => Number.parseFloat(value ?? '');

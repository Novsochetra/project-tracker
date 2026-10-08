import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(import.meta.dirname, '../../src');
// The phone the design is drawn for; pass another width to read narrower phones' rules.
const PHONE_WIDTH = 375;

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

// Plain rules and the `max-width` queries a phone this wide falls under, such as the 767px one.
function appliesAt(rule: Rule, width: number): boolean {
  const maxWidth = /^@media \(max-width: (\d+)px\)$/.exec(rule.media);
  return rule.media === '' || (maxWidth !== null && width <= Number(maxWidth[1]));
}

function declarations(rule: Rule): [string, string][] {
  return rule.body
    .split(';')
    .map((line) => line.split(':').map((part) => part.trim()))
    .flatMap(([name, ...value]) => (name ? [[name, value.join(':')] as [string, string]] : []));
}

function phoneTokens(width: number): Map<string, string> {
  const rules = rulesOf(readCss('design/tokens.css'));
  const roots = rules.filter((rule) => rule.selector === ':root' && appliesAt(rule, width));
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
export function phoneStyle(
  element: Element,
  cssModule: string,
  width = PHONE_WIDTH,
): Map<string, string> {
  const tokens = phoneTokens(width);
  const style = new Map<string, string>();
  for (const rule of rulesOf(readCss(cssModule))) {
    if (!appliesAt(rule, width) || !styles(rule.selector, element)) continue;
    for (const [name, value] of declarations(rule)) style.set(name, resolve(value, tokens));
  }
  return style;
}

// For selectors phoneStyle can't match on an element, such as `.remove::before` or
// `.grid.removable`: the rules written exactly as `selector`, the last one winning.
export function phoneRule(
  cssModule: string,
  selector: string,
  width = PHONE_WIDTH,
): Map<string, string> {
  const tokens = phoneTokens(width);
  const style = new Map<string, string>();
  for (const rule of rulesOf(readCss(cssModule))) {
    if (!appliesAt(rule, width) || rule.selector !== selector) continue;
    for (const [name, value] of declarations(rule)) style.set(name, resolve(value, tokens));
  }
  return style;
}

export const pixels = (value: string | undefined): number => Number.parseFloat(value ?? '');

// A box shorthand such as `inset` or `padding`, as [top, right, bottom, left] in pixels.
export function edges(value: string | undefined): [number, number, number, number] {
  const [top = 0, right = top, bottom = top, left = right] = (value ?? '')
    .trim()
    .split(/\s+/)
    .map(pixels);
  return [top, right, bottom, left];
}

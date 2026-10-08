import { screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTicketDetail, project, statuses } from '../../src/api/test/fixtures';
import { PromptSheet } from '../../src/features/claude/PromptSheet';
import { ReportSheet } from '../../src/features/claude/ReportSheet';
import { renderWithApi, sheetTestSetup } from '../../src/features/claude/test/renderWithApi';

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

// A small cascade is enough: these modules style their boxes with plain class rules, so the last
// matching declaration at phone width wins.
function phoneFontSize(element: Element, cssModule: string): string | undefined {
  const tokens = phoneTokens();
  let size: string | undefined;
  for (const rule of rulesOf(readCss(cssModule))) {
    if (!appliesOnPhones(rule) || !styles(rule.selector, element)) continue;
    for (const [name, value] of declarations(rule)) {
      const resolved = resolve(value, tokens);
      if (name === 'font-size') size = resolved;
      if (name === 'font') size = /(\d+(?:\.\d+)?px)/.exec(resolved)?.[1];
    }
  }
  return size;
}

let restore: () => void;

beforeEach(() => {
  restore = sheetTestSetup(true);
});

afterEach(() => {
  restore();
});

// iOS Safari zooms the page into a focused field whose text is under 16px, and the viewport
// allows zooming, so the prompt box (mono 12px in the design) zoomed in when tapped (SPEC §11).
describe('regression: the Claude Code sheet boxes use 16px text on phones', () => {
  it('in the Send to Claude Code prompt box', async () => {
    renderWithApi(
      <PromptSheet open onClose={() => undefined} scope={{ kind: 'ticket', ticketKey: 'MOB-1' }} />,
      {
        getTicketPrompt: vi
          .fn()
          .mockResolvedValue({ text: 'Please work on MOB-1', ticketCount: 1 }),
        getTicket: vi.fn().mockResolvedValue(makeTicketDetail()),
      },
    );
    const box = await screen.findByRole('textbox', { name: 'Prompt for Claude Code' });
    expect(phoneFontSize(box, 'features/claude/PromptSheet.module.css')).toBe('16px');
  });

  it('in the Paste report box', () => {
    renderWithApi(
      <ReportSheet open onClose={() => undefined} scope={{ kind: 'project', projectKey: 'MOB' }} />,
      { getProject: vi.fn().mockResolvedValue({ project, statuses }) },
    );
    const box = screen.getByRole('textbox', { name: 'Report' });
    expect(phoneFontSize(box, 'features/claude/ReportSheet.module.css')).toBe('16px');
  });
});

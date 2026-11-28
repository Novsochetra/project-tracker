import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '../../src');

// Status, label and project colors are data picked for white. Drawn as a mark they go through
// markColor (StatusGlyph, LabelDot, ColorMark, the color swatches, the progress bar), which keeps
// 3:1 in the dark appearance (data-colors-contrast.test.ts). PT-287's review found project
// squares that set the raw color as an inline style instead.
const MARKS = [
  'components/StatusGlyph/StatusGlyph.tsx',
  'components/ColorMark/ColorMark.tsx',
  'features/labels/LabelDot.tsx',
  'features/statuses/ColorSwatches.tsx',
  'features/projects/ProjectProgressBar.tsx',
];

// Where a raw data color is still right: a compact label chip tints its background 16% toward it
// under --ink-2 text, and a verdict chip's text color comes from chipTextColor.
const ALLOWED = ['features/labels/LabelChips.tsx', 'components/VerdictChip/VerdictChip.tsx'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'dev' ? [] : sourceFiles(path);

    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [path] : [];
  });
}

// A property set straight from a color value (`background: project.color`, `background:
// readyColor`), not from a call such as useMarkColor(color).
const RAW_COLOR = /:\s*(?:\w+\??\.color|\w*[a-z]Color)\b(?!\()/;

const inlineStyles = (code: string): string[] =>
  [...code.matchAll(/style=\{([\s\S]*?)\}\s*(?:\/>|>|\n\s*[\w-]+=)/g)].map((match) => match[1]!);

describe('regression: every data color drawn as a mark goes through markColor', () => {
  it('sets no status, label or project color as a raw inline style', () => {
    const raw = sourceFiles(SRC).flatMap((file) => {
      const name = relative(SRC, file);
      if (ALLOWED.includes(name)) return [];

      return inlineStyles(readFileSync(file, 'utf8'))
        .filter((style) => RAW_COLOR.test(style))
        .map((style) => `${name}: ${style.trim()}`);
    });
    expect(raw).toEqual([]);
  });

  it.each(MARKS)('%s draws its color through markColor', (file) => {
    expect(readFileSync(join(SRC, file), 'utf8')).toMatch(/\b(useMarkColor|markColor)\(/);
  });
});

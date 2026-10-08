import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ReviewVerdict } from '../../src/features/ticket/activity/ReviewVerdict';
import { contrast, mix, parseHex, WHITE } from '../../src/lib/contrast';

const SRC = join(import.meta.dirname, '../../src');
const TEAL = '#12A594';

// Like the stylesheet: the chip's own text color, else the status color.
function chipText(label: string): string {
  const chip = screen.getByText(label).closest<HTMLElement>('[style]')!;
  const own = chip.style.getPropertyValue('--verdict-text');
  return own || chip.style.getPropertyValue('--verdict');
}

// PT-39: an approved chip draws its label in the Reviewed status color on a 10% tint of it, so a
// lighter custom status color, such as teal, left the label at 2.77:1.
describe('regression: a verdict chip in a custom status color stays readable', () => {
  it('draws "Approved" at 4.5:1 or more on a teal status color’s tint', () => {
    render(<ReviewVerdict review={{ verdict: 'approved', rating: 4 }} approvedColor={TEAL} />);
    const tint = mix(parseHex(TEAL)!, WHITE, 0.1);
    expect(contrast(parseHex(chipText('Approved'))!, tint)).toBeGreaterThanOrEqual(4.5);
  });

  // The check above mirrors the stylesheet: a 10% tint of the color over the white surface,
  // with the text in --verdict-text.
  it('reads the tint and text color the check assumes', () => {
    const css = readFileSync(join(SRC, 'components/VerdictChip/VerdictChip.module.css'), 'utf8');
    expect(css).toContain('background: color-mix(in srgb, var(--verdict) 10%, var(--surface));');
    expect(css).toContain('color: var(--verdict-text);');
    const tokens = readFileSync(join(SRC, 'design/tokens.css'), 'utf8');
    expect(tokens).toMatch(/--surface:\s*#fff(fff)?;/i);
  });
});

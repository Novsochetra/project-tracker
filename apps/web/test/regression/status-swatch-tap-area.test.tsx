import { render, screen } from '@testing-library/react';
import { STATUS_COLORS } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { ColorSwatches } from '../../src/features/statuses/ColorSwatches';
import { phoneStyle, pixels } from './phoneCss';

const MODULE = 'features/statuses/StatusEditor.module.css';

// The swatches were 34px wide on phones so all nine fit one row, under the 44×44 tap area that
// SPEC §12 gives small controls.
describe('regression: status color swatches have 44×44 tap areas on phones', () => {
  it('sizes each swatch, the label its radio fills, to at least 44×44', () => {
    render(<ColorSwatches value={STATUS_COLORS[1]} onChange={() => undefined} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(STATUS_COLORS.length);
    for (const radio of radios) {
      const style = phoneStyle(radio.closest('label')!, MODULE);
      expect(pixels(style.get('width'))).toBeGreaterThanOrEqual(44);
      expect(pixels(style.get('height'))).toBeGreaterThanOrEqual(44);
    }
  });

  it('keeps the dots their phone size', () => {
    render(<ColorSwatches value={STATUS_COLORS[1]} onChange={() => undefined} />);
    const dot = screen.getAllByRole('radio')[0]!.nextElementSibling!;
    const style = phoneStyle(dot, MODULE);
    expect([style.get('width'), style.get('height')]).toEqual(['26px', '26px']);
  });
});

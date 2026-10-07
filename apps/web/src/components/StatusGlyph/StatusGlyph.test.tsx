import { STATUS_CATEGORIES, type StatusCategory } from '@tracker/shared';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusGlyph } from './StatusGlyph';

function shape(category: StatusCategory) {
  const { container } = render(<StatusGlyph category={category} color="rgb(194, 106, 6)" />);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('no glyph');
  const circles = Array.from(svg.querySelectorAll('circle'));
  const paths = Array.from(svg.querySelectorAll('path'));
  return { svg, circles, paths };
}

const isRing = (circle: SVGCircleElement | undefined) =>
  circle?.getAttribute('r') === '6.25' && circle.getAttribute('fill') === 'none';

describe('StatusGlyph', () => {
  it('draws an empty ring for to do', () => {
    const { circles, paths } = shape('todo');
    expect(circles).toHaveLength(1);
    expect(isRing(circles[0])).toBe(true);
    expect(paths).toHaveLength(0);
  });

  it('adds a half pie for in progress', () => {
    const { circles, paths } = shape('in_progress');
    expect(isRing(circles[0])).toBe(true);
    expect(paths[0]?.getAttribute('d')).toBe('M8 4.5a3.5 3.5 0 0 1 0 7z');
  });

  it('adds a three-quarter pie for in review', () => {
    const { circles, paths } = shape('in_review');
    expect(isRing(circles[0])).toBe(true);
    expect(paths[0]?.getAttribute('d')).toBe('M8 4.5a3.5 3.5 0 1 1-3.5 3.5H8z');
  });

  it('fills the ring for reviewed', () => {
    const { circles, paths } = shape('reviewed');
    expect(isRing(circles[0])).toBe(true);
    expect(circles[1]?.getAttribute('r')).toBe('3.5');
    expect(paths).toHaveLength(0);
  });

  it('draws a filled circle with a check that pops in for done', () => {
    const { svg, circles, paths } = shape('done');
    expect(circles).toHaveLength(1);
    expect(circles[0]?.getAttribute('r')).toBe('7');
    expect(paths[0]).toHaveClass('check');
    expect(svg).toHaveClass('animated');
  });

  it('gives every category a distinct shape in the status color', () => {
    const outlines = STATUS_CATEGORIES.map((category) => {
      const { svg } = shape(category);
      expect(svg).toHaveStyle({ color: 'rgb(194, 106, 6)' });
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      return svg.innerHTML;
    });
    expect(new Set(outlines).size).toBe(STATUS_CATEGORIES.length);
  });
});

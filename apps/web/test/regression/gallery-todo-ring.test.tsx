import { render, screen } from '@testing-library/react';
import { DEFAULT_STATUSES } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { ComponentsDemo } from '../../src/dev/componentsDemo';

const TODO = DEFAULT_STATUSES.find((status) => status.category === 'todo')!;

describe('regression: the dev gallery draws To do rings like the app', () => {
  it('colors them with the To do status color', () => {
    render(<ComponentsDemo />);
    const rings = screen
      .getByRole('region', { name: 'Lists' })
      .querySelectorAll('svg[data-category="todo"]');
    expect(rings.length).toBeGreaterThan(0);
    for (const ring of rings) expect(ring).toHaveStyle({ color: TODO.color });
  });
});

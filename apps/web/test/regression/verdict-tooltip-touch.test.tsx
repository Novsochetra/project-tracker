import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ICON_ONLY_QUERY, VerdictChip } from '../../src/components/VerdictChip/VerdictChip';
import { NO_HOVER_QUERY, PHONE_QUERY } from '../../src/lib/media';

// The lead (PT-74): an icon-only chip named itself in a `title` on phones too, where nothing can
// hover it, so the tooltip never shows; it is for mouse users in a desktop window under 1024px.

let restoreMedia: () => void = () => undefined;

afterEach(() => restoreMedia());

function mockMedia(matching: readonly string[]) {
  const previous = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: matching.includes(query),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
  restoreMedia = () => {
    if (previous) Object.defineProperty(window, 'matchMedia', previous);
    else Reflect.deleteProperty(window, 'matchMedia');
  };
}

const chip = () => screen.getByText('Changes requested').closest<HTMLElement>('[data-verdict]')!;

describe('regression: the icon-only verdict chip on a touch screen', () => {
  it('has no tooltip on a phone, and keeps its label for screen readers', () => {
    mockMedia([ICON_ONLY_QUERY, PHONE_QUERY, NO_HOVER_QUERY]);
    render(
      <button type="button">
        MOB-3 <VerdictChip verdict="changes_requested" compact />
      </button>,
    );
    expect(chip()).not.toHaveAttribute('title');
    expect(screen.getByRole('button')).toHaveAccessibleName('MOB-3 Changes requested');
  });

  it('has no tooltip on a touch tablet under 1024px either', () => {
    mockMedia([ICON_ONLY_QUERY, NO_HOVER_QUERY]);
    render(<VerdictChip verdict="changes_requested" compact />);
    expect(chip()).not.toHaveAttribute('title');
  });

  it('keeps the tooltip for a mouse in a narrow window', () => {
    mockMedia([ICON_ONLY_QUERY, PHONE_QUERY]);
    render(<VerdictChip verdict="changes_requested" compact />);
    expect(chip()).toHaveAttribute('title', 'Changes requested');
  });
});

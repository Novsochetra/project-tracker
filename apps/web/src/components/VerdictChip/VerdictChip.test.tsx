import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { chipTextColor } from './chipText';
import { ICON_ONLY_QUERY, VerdictChip } from './VerdictChip';

let restoreMedia: () => void = () => undefined;

afterEach(() => restoreMedia());

function mockWidth(width: number) {
  const previous = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === ICON_ONLY_QUERY && width <= 1023,
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

const chipOf = (label: string) => screen.getByText(label).closest<HTMLElement>('[data-verdict]')!;

describe('VerdictChip', () => {
  it('labels each verdict, with an icon', () => {
    render(
      <>
        <VerdictChip verdict="approved" />
        <VerdictChip verdict="changes_requested" />
      </>,
    );
    expect(chipOf('Approved')).toHaveAttribute('data-verdict', 'approved');
    expect(chipOf('Changes requested')).toHaveAttribute('data-verdict', 'changes_requested');
    for (const chip of [chipOf('Approved'), chipOf('Changes requested')]) {
      expect(chip.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('draws an approval in the Reviewed status color, with text picked to read on it', () => {
    render(<VerdictChip verdict="approved" approvedColor="#12A594" />);
    const chip = chipOf('Approved');
    expect(chip.style.getPropertyValue('--verdict')).toBe('#12A594');
    expect(chip.style.getPropertyValue('--verdict-text')).toBe(chipTextColor('#12A594'));
  });

  it('keeps the design colors without a status color', () => {
    render(<VerdictChip verdict="approved" />);
    expect(chipOf('Approved').getAttribute('style')).toBeNull();
  });

  it('keeps Changes requested in the danger color whatever the status color', () => {
    render(<VerdictChip verdict="changes_requested" approvedColor="#12A594" />);
    const chip = chipOf('Changes requested');
    expect(chip.getAttribute('style')).toBeNull();
    expect(chip).toHaveClass('changes');
  });

  it('keeps the label for screen readers when it is compact', () => {
    render(<VerdictChip verdict="changes_requested" compact className="extra" />);
    const chip = chipOf('Changes requested');
    expect(chip).toHaveClass('compact', 'extra');
    expect(chip).toHaveTextContent('Changes requested');
  });

  // Reviewer 29 (PT-55): a desktop window 768–1023px wide shows only the icon on a row.
  it('names an icon-only chip in a tooltip for mouse users', () => {
    mockWidth(900);
    render(
      <button type="button">
        MOB-3 <VerdictChip verdict="changes_requested" compact />
      </button>,
    );
    expect(chipOf('Changes requested')).toHaveAttribute('title', 'Changes requested');
    expect(screen.getByRole('button')).toHaveAccessibleName('MOB-3 Changes requested');
  });

  it('adds no tooltip where the label shows', () => {
    mockWidth(1280);
    render(
      <>
        <VerdictChip verdict="changes_requested" compact />
        <VerdictChip verdict="approved" />
      </>,
    );
    expect(chipOf('Changes requested')).not.toHaveAttribute('title');
    expect(chipOf('Approved')).not.toHaveAttribute('title');
  });

  it('adds no tooltip to a full chip in a narrow window', () => {
    mockWidth(900);
    render(<VerdictChip verdict="approved" />);
    expect(chipOf('Approved')).not.toHaveAttribute('title');
  });

  it('asks for the tooltip at the width where the CSS hides the label', () => {
    const css = readFileSync(join(import.meta.dirname, 'VerdictChip.module.css'), 'utf8');
    expect(css).toContain(`@media ${ICON_ONLY_QUERY} {\n  .compact {`);
  });
});

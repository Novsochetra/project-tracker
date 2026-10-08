import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { chipTextColor } from './chipText';
import { VerdictChip } from './VerdictChip';

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
});

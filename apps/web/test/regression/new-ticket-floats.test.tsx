import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaptureBar } from '../../src/features/capture/CaptureEntry';
import { mockPhone } from '../../src/overlays/testing';

// The owner asked for New ticket as a floating button over the phone's bottom right corner
// instead of a bar across the screen (PT-264). It keeps its name for screen readers and tests.

let restore: () => void = () => undefined;

afterEach(() => {
  restore();
});

describe('regression: New ticket floats on phones', () => {
  it('is a round floating button named New ticket, with no bar', () => {
    restore = mockPhone(true);
    render(<CaptureBar onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'New ticket' });
    expect(button.closest('[data-bottom-bar]')).toHaveAttribute('data-floating');
  });
});

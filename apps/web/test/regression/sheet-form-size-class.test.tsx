import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Sheet } from '../../src/overlays';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

describe('regression: the default "form" sheet size must not reuse the <form> layout class', () => {
  let restore: (() => void)[] = [];

  beforeEach(() => {
    restore = [mockPhone(false), skipAnimations()];
  });

  afterEach(() => restore.forEach((undo) => undo()));

  it('keeps the overlay classes separate from the form classes', () => {
    render(
      <Sheet
        open
        onClose={() => undefined}
        label="New project"
        title="New project"
        onSubmit={() => undefined}
      >
        <input aria-label="Project name" />
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'New project' });
    const form = dialog.querySelector('form');
    const overlay = dialog.closest('[data-sheet]');
    if (!form || !overlay) throw new Error('Sheet markup changed');
    const formClasses = [...form.classList];
    expect(formClasses.length).toBeGreaterThan(0);
    for (const name of formClasses) expect(overlay.classList.contains(name)).toBe(false);
  });
});

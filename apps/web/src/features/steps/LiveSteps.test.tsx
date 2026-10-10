import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveSteps } from './LiveSteps';
import { foldMotion } from './rowMotion';
import { stepRows } from './stepRows';
import { makeStep } from './testSteps';

const LONG = Array.from({ length: 9 }, (_, line) => `Line ${line + 1}.`).join('\n');
const words = (seq: number) => makeStep(seq, { kind: 'text', label: LONG, toolId: null });

interface FakeAnimation {
  element: Element;
  frames: Keyframe[];
  options: KeyframeAnimationOptions;
  onfinish: (() => void) | null;
}

let animations: FakeAnimation[] = [];

beforeEach(() => {
  animations = [];
  // jsdom lays nothing out: a row of Claude's 9 lines is 216px high, any other 24px.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return { height: this.textContent?.includes('Line 9.') ? 216 : 24 } as DOMRect;
  });
  Element.prototype.animate = vi.fn(function (
    this: Element,
    frames: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    const animation: FakeAnimation = { element: this, frames, options, onfinish: null };
    animations.push(animation);
    return animation as unknown as Animation;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const rowsOf = (seq: number[]) => seq.map((each) => (each === 5 ? words(5) : makeStep(each)));
const all = () => screen.getAllByRole('listitem', { hidden: true });

describe('LiveSteps', () => {
  it("shows Claude's words whole, newest or not", () => {
    render(<LiveSteps rows={stepRows([words(1), makeStep(2)])} />);
    expect(screen.getByText(/Line 9\./)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps the node of a row that starts to leave, so it folds from where it is', () => {
    const { rerender } = render(<LiveSteps rows={stepRows(rowsOf([1, 2, 3, 4, 5]))} />);
    const first = all()[0];
    rerender(<LiveSteps rows={stepRows(rowsOf([1, 2, 3, 4, 5, 6]))} />);
    expect(all()[0]).toBe(first);
    expect(first).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('folds a batch of rows that leave together, in one length from their total height', () => {
    const { rerender } = render(<LiveSteps rows={stepRows(rowsOf([1, 2, 3, 4, 5]))} />);
    rerender(<LiveSteps rows={stepRows(rowsOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))} />);
    expect(animations).toHaveLength(5);
    const lengths = new Set(animations.map(({ options }) => options.duration));
    expect([...lengths]).toEqual([foldMotion(4 * 24 + 216).duration]);
    expect(animations[4]?.frames.at(-1)).toMatchObject({ height: '0px', opacity: 0 });
    expect(animations[4]?.options.fill).toBe('forwards');
  });

  it('drops a folded row once its fold ends, and folds only new leavers after', () => {
    const { rerender } = render(<LiveSteps rows={stepRows(rowsOf([1, 2, 3, 4, 5]))} />);
    rerender(<LiveSteps rows={stepRows(rowsOf([1, 2, 3, 4, 5, 6]))} />);
    act(() => animations[0]?.onfinish?.());
    expect(all()).toHaveLength(5);
    expect(screen.queryByText(/file1\.ts/)).not.toBeInTheDocument();
    rerender(<LiveSteps rows={stepRows(rowsOf([1, 2, 3, 4, 5, 6, 7]))} />);
    expect(animations).toHaveLength(2);
    expect(animations[1]?.element).toHaveTextContent('file2.ts');
  });

  it('moves nothing with reduced motion: rows that leave just go', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
    const { rerender } = render(<LiveSteps rows={stepRows(rowsOf([1, 2, 3, 4, 5]))} />);
    rerender(<LiveSteps rows={stepRows(rowsOf([1, 2, 3, 4, 5, 6]))} />);
    expect(animations).toHaveLength(0);
    expect(all()).toHaveLength(5);
  });

  it('shows a folding row again, unfolded, when the earlier steps are opened', async () => {
    const cancel = vi.fn();
    Element.prototype.getAnimations = vi.fn(() => [{ cancel } as unknown as Animation]);
    const { rerender } = render(<LiveSteps rows={stepRows(rowsOf([1, 2, 3, 4, 5]))} />);
    rerender(<LiveSteps rows={stepRows(rowsOf([1, 2, 3, 4, 5, 6]))} />);
    const folding = all()[0];
    await userEvent.setup().click(screen.getByRole('button', { name: '1 earlier step' }));
    expect(all()[0]).toBe(folding);
    expect(folding).not.toHaveAttribute('aria-hidden');
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(cancel).toHaveBeenCalled();
  });
});

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveSteps } from './LiveSteps';
import { stepRows } from './stepRows';
import { makeStep, makeSteps } from './testSteps';

const LONG = Array.from({ length: 9 }, (_, line) => `Line ${line + 1}.`).join('\n');
const words = (seq: number) => makeStep(seq, { kind: 'text', label: LONG, toolId: null });

interface FakeAnimation {
  element: Element;
  frames: Keyframe[];
  onfinish: (() => void) | null;
}

let animations: FakeAnimation[] = [];

beforeEach(() => {
  animations = [];
  // jsdom lays nothing out: a cut row is 3 lines high, a whole one 9, any other 1.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const lines = (this as HTMLElement).style?.getPropertyValue('--step-lines');
    const height = this.textContent?.includes('Line 9.') && !lines ? 216 : lines ? 72 : 24;
    return { height } as DOMRect;
  });
  Element.prototype.animate = vi.fn(function (this: Element, frames: Keyframe[]) {
    const animation: FakeAnimation = { element: this, frames, onfinish: null };
    animations.push(animation);
    return animation as unknown as Animation;
  });
});

afterEach(() => vi.restoreAllMocks());

const items = () => screen.getAllByRole('listitem', { hidden: false });

describe('LiveSteps', () => {
  it("eases the row whose words were cut from its old height, not the list's", () => {
    const { rerender } = render(<LiveSteps rows={stepRows([makeStep(1), words(2)])} />);
    expect(animations).toHaveLength(0);
    rerender(<LiveSteps rows={stepRows([makeStep(1), words(2), makeStep(3)])} />);
    const shrink = animations.find(({ frames }) => frames[0]?.height === '216px');
    expect(shrink?.frames).toEqual([{ height: '216px' }, { height: '72px' }]);
    expect(shrink?.element.tagName).toBe('LI');
  });

  it('opens a cut row whole with a tap and cuts it again with another', async () => {
    render(<LiveSteps rows={stepRows([words(1), makeStep(2)])} />);
    const user = userEvent.setup();
    const row = screen.getByRole('button', { name: /^Line 1\.[\s\S]*Line 9\.$/ });
    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(items()[0]).toHaveStyle({ '--step-lines': '3' });
    await user.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(items()[0]?.style.getPropertyValue('--step-lines')).toBe('');
    await user.click(row);
    expect(items()[0]).toHaveStyle({ '--step-lines': '3' });
  });

  it('shows every word whole once the earlier steps are open', async () => {
    render(<LiveSteps rows={stepRows([words(1), ...makeSteps(6, 2)])} />);
    await userEvent.setup().click(screen.getByRole('button', { name: '2 earlier steps' }));
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(7);
    expect(within(list).queryByRole('button')).not.toBeInTheDocument();
  });

  it('folds away the rows a new step pushes out, then drops them', () => {
    const { rerender } = render(<LiveSteps rows={stepRows(makeSteps(5))} />);
    rerender(<LiveSteps rows={stepRows(makeSteps(6))} />);
    const leaving = screen.getAllByRole('listitem', { hidden: true })[0];
    expect(leaving).toHaveAttribute('aria-hidden', 'true');
    expect(leaving).toHaveTextContent('file1.ts');
    expect(items()).toHaveLength(5);
    const fold = animations.find(({ element }) => element === leaving);
    expect(fold?.frames.at(-1)).toMatchObject({ height: '0px', opacity: 0 });
    act(() => fold?.onfinish?.());
    expect(screen.getAllByRole('listitem', { hidden: true })).toHaveLength(5);
    expect(screen.queryByText(/file1\.ts/)).not.toBeInTheDocument();
  });

  it('moves nothing with reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
    const { rerender } = render(<LiveSteps rows={stepRows([...makeSteps(4), words(5)])} />);
    rerender(<LiveSteps rows={stepRows([...makeSteps(4), words(5), makeStep(6)])} />);
    expect(animations).toHaveLength(0);
    expect(screen.getAllByRole('listitem', { hidden: true })).toHaveLength(5);
    vi.unstubAllGlobals();
  });
});

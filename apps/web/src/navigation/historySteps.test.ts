import { describe, expect, it, vi } from 'vitest';
import { historySteps } from './historySteps';
import { SessionHistory } from './sessionHistory';

function historyAt(paths: string[], index: number): SessionHistory {
  const history = new SessionHistory();
  paths.forEach((path, i) => history.record(`k${i}`, path, i === 0 ? 'POP' : 'PUSH'));
  history.record(`k${index}`, paths[index]!, 'POP');
  return history;
}

describe('historySteps', () => {
  it('steps through the session history both ways', () => {
    const go = vi.fn();
    const steps = historySteps({
      history: historyAt(['/', '/p/PT', '/p/PT/1'], 1),
      go,
      backToParent: null,
    });
    expect(steps.canStep('back')).toBe(true);
    expect(steps.canStep('forward')).toBe(true);
    steps.step('back');
    steps.step('forward');
    expect(go.mock.calls).toEqual([[-1], [1]]);
  });

  it('goes to the parent screen when nothing is behind a deep link', () => {
    const go = vi.fn();
    const backToParent = vi.fn();
    const steps = historySteps({ history: historyAt(['/p/PT/1'], 0), go, backToParent });
    expect(steps.canStep('back')).toBe(true);
    steps.step('back');
    expect(backToParent).toHaveBeenCalledOnce();
    expect(go).not.toHaveBeenCalled();
  });

  it('has nowhere to go at the first screen with no forward entry', () => {
    const go = vi.fn();
    const steps = historySteps({ history: historyAt(['/'], 0), go, backToParent: null });
    expect(steps.canStep('back')).toBe(false);
    expect(steps.canStep('forward')).toBe(false);
    steps.step('forward');
    steps.step('back');
    expect(go).not.toHaveBeenCalled();
  });
});

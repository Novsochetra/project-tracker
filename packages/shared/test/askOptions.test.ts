import { describe, expect, it } from 'vitest';
import { chosenAskOptions } from '../src/domain/askOptions';

describe('chosenAskOptions', () => {
  const saved = { model: 'opus', mode: 'plan', effort: 'high' } as const;

  it('keeps the saved model, mode and effort the question leaves out', () => {
    expect(chosenAskOptions({}, saved)).toEqual(saved);
    expect(chosenAskOptions({ mode: 'edit' }, saved)).toEqual({ ...saved, mode: 'edit' });
    expect(chosenAskOptions({ model: 'haiku' }, saved)).toEqual({ ...saved, model: 'haiku' });
    expect(chosenAskOptions({ effort: 'low' }, saved)).toEqual({ ...saved, effort: 'low' });
  });

  it('starts a new chat with Default, Ask and the default effort', () => {
    const defaults = { model: 'default', mode: 'ask', effort: 'default' };
    expect(chosenAskOptions({})).toEqual(defaults);
    expect(chosenAskOptions({ model: 'sonnet' })).toEqual({ ...defaults, model: 'sonnet' });
  });
});

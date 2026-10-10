import { describe, expect, it } from 'vitest';
import { chosenAskOptions } from '../src/domain/askOptions';

describe('chosenAskOptions', () => {
  const saved = { model: 'opus', mode: 'plan' } as const;

  it('keeps the saved model and mode the question leaves out', () => {
    expect(chosenAskOptions({}, saved)).toEqual(saved);
    expect(chosenAskOptions({ mode: 'edit' }, saved)).toEqual({ model: 'opus', mode: 'edit' });
    expect(chosenAskOptions({ model: 'haiku' }, saved)).toEqual({ model: 'haiku', mode: 'plan' });
  });

  it('starts a new chat with Default and Ask', () => {
    expect(chosenAskOptions({})).toEqual({ model: 'default', mode: 'ask' });
    expect(chosenAskOptions({ model: 'sonnet' })).toEqual({ model: 'sonnet', mode: 'ask' });
  });
});

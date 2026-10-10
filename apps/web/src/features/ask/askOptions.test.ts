import { DEFAULT_ASK_OPTIONS } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { askInputOf, askOptionsHint, initialAskOptions } from './askOptions';
import { EDIT_HINT } from './copy';

describe('initialAskOptions', () => {
  it('starts a new chat from the defaults', () => {
    expect(initialAskOptions(null)).toEqual(DEFAULT_ASK_OPTIONS);
  });

  it('starts an existing chat from its last choice', () => {
    const options = { model: 'opus', mode: 'plan' } as const;
    expect(initialAskOptions({ options })).toEqual(options);
  });

  it('starts a chat whose server sent no options from the defaults', () => {
    expect(initialAskOptions({} as never)).toEqual(DEFAULT_ASK_OPTIONS);
  });
});

describe('askInputOf', () => {
  it('sends the chosen names with the text', () => {
    expect(askInputOf('h-1', 'Hi', { model: 'haiku', mode: 'edit' })).toEqual({
      runnerId: 'h-1',
      text: 'Hi',
      model: 'haiku',
      mode: 'edit',
    });
  });
});

describe('askOptionsHint', () => {
  it('warns only when Edit is picked', () => {
    expect(askOptionsHint({ model: 'default', mode: 'edit' })).toBe(EDIT_HINT);
    expect(askOptionsHint({ model: 'default', mode: 'ask' })).toBeNull();
    expect(askOptionsHint({ model: 'opus', mode: 'plan' })).toBeNull();
  });
});

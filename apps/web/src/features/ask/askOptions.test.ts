import { DEFAULT_ASK_OPTIONS } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { askInputOf, askOptionsHint, savedAskOptions } from './askOptions';
import { AUTO_HINT, EDIT_HINT } from './copy';

describe('savedAskOptions', () => {
  it('starts a new chat from the defaults', () => {
    expect(savedAskOptions(null)).toEqual(DEFAULT_ASK_OPTIONS);
  });

  it('starts an existing chat from its last choice', () => {
    const options = { model: 'opus', mode: 'plan', effort: 'high' } as const;
    expect(savedAskOptions({ options })).toEqual(options);
  });

  it('starts a chat whose server sent no effort on the default effort', () => {
    const options = { model: 'opus', mode: 'plan' } as never;
    expect(savedAskOptions({ options })).toEqual({
      model: 'opus',
      mode: 'plan',
      effort: 'default',
    });
  });

  it('starts a chat whose server sent no options from the defaults', () => {
    expect(savedAskOptions({} as never)).toEqual(DEFAULT_ASK_OPTIONS);
  });
});

describe('askInputOf', () => {
  it('sends the chosen names with the text', () => {
    expect(askInputOf('h-1', 'Hi', { model: 'opus', mode: 'edit', effort: 'max' })).toEqual({
      runnerId: 'h-1',
      text: 'Hi',
      model: 'opus',
      mode: 'edit',
      effort: 'max',
    });
  });
});

describe('askOptionsHint', () => {
  it('warns only when Edit or Auto is picked', () => {
    expect(askOptionsHint({ ...DEFAULT_ASK_OPTIONS, mode: 'edit' })).toBe(EDIT_HINT);
    expect(askOptionsHint({ ...DEFAULT_ASK_OPTIONS, mode: 'auto' })).toBe(AUTO_HINT);
    expect(askOptionsHint(DEFAULT_ASK_OPTIONS)).toBeNull();
    expect(askOptionsHint({ model: 'opus', mode: 'plan', effort: 'low' })).toBeNull();
  });
});

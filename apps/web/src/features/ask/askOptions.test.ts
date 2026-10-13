import { DEFAULT_ASK_OPTIONS } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { askInputOf, askOptionsHint, savedAskOptions } from './askOptions';
import { ASK_HINT, EDIT_HINT, PLAN_HINT } from './copy';

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
  it('sends the chosen names with the text and the files', () => {
    const question = { text: 'Hi', attachmentIds: ['f-1', 'f-2'] };
    expect(askInputOf('h-1', question, { model: 'opus', mode: 'edit', effort: 'max' })).toEqual({
      runnerId: 'h-1',
      text: 'Hi',
      attachmentIds: ['f-1', 'f-2'],
      model: 'opus',
      mode: 'edit',
      effort: 'max',
    });
  });
});

describe('askOptionsHint', () => {
  it('says what each mode lets Claude do', () => {
    expect(askOptionsHint(DEFAULT_ASK_OPTIONS)).toBe(ASK_HINT);
    expect(askOptionsHint({ model: 'opus', mode: 'plan', effort: 'low' })).toBe(PLAN_HINT);
    expect(askOptionsHint({ ...DEFAULT_ASK_OPTIONS, mode: 'edit' })).toBe(EDIT_HINT);
  });
});

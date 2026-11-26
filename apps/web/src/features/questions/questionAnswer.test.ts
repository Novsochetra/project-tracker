import { describe, expect, it } from 'vitest';
import { answerOf, NO_PICK, pickChoice, typeOther } from './questionAnswer';

describe('a question pick', () => {
  it('answers with the chosen choice or the own words, trimmed', () => {
    expect(answerOf(NO_PICK)).toBeNull();
    expect(answerOf(pickChoice('Night'))).toEqual({ answer: 'Night' });
    expect(answerOf(typeOther(NO_PICK, '  Call it Dusk '))).toEqual({ answer: 'Call it Dusk' });
    expect(answerOf(typeOther(NO_PICK, '   '))).toBeNull();
  });

  it('drops the own words for a choice, and the choice for own words', () => {
    expect(pickChoice('Night')).toEqual({ chosen: 'Night', other: '' });
    expect(typeOther(pickChoice('Night'), 'Dusk')).toEqual({ chosen: null, other: 'Dusk' });
  });

  it('keeps the choice while the box holds only spaces', () => {
    expect(typeOther(pickChoice('Night'), ' ')).toEqual({ chosen: 'Night', other: ' ' });
  });
});

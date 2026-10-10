import { RUN_REQUEST_ANSWER_MAX } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { makeQuestion } from '../../api/test/requestFixtures';
import {
  ALLOW,
  answerOf,
  answersAtOnce,
  choiceAnswer,
  DENY,
  NO_PICK,
  otherRoom,
  questionAnswers,
  SKIP,
  togglePick,
  typeOther,
} from './requestAnswers';

const single = makeQuestion();
const multi = makeQuestion({
  multiSelect: true,
  options: [
    { label: 'a.txt', description: '' },
    { label: 'b.txt', description: '' },
    { label: 'c.txt', description: '' },
  ],
});

describe('a permission', () => {
  it('is allowed or denied with the decision alone', () => {
    expect(ALLOW).toEqual({ decision: 'allow' });
    expect(DENY).toEqual({ decision: 'deny' });
  });
});

describe('a question', () => {
  it('answers one question with one choice at the tap on a choice', () => {
    expect(answersAtOnce([single])).toBe(true);
    expect(answersAtOnce([multi])).toBe(false);
    expect(answersAtOnce([single, single])).toBe(false);
    expect(choiceAnswer('syncQueue')).toEqual({ decision: 'allow', answers: ['syncQueue'] });
  });

  it('is skipped with a deny and no answers', () => {
    expect(SKIP).toEqual({ decision: 'deny' });
  });

  it('keeps one choice of a single choice question, and a second tap takes it back', () => {
    const picked = togglePick(single, NO_PICK, 'syncQueue');
    expect(picked).toEqual({ chosen: ['syncQueue'], other: '' });
    expect(togglePick(single, picked, 'captureQueue').chosen).toEqual(['captureQueue']);
    expect(togglePick(single, picked, 'syncQueue').chosen).toEqual([]);
  });

  it('keeps several choices of a multi choice question, in the order Claude gave them', () => {
    const picked = togglePick(multi, togglePick(multi, NO_PICK, 'c.txt'), 'a.txt');
    expect(picked.chosen).toEqual(['a.txt', 'c.txt']);
    expect(togglePick(multi, picked, 'c.txt').chosen).toEqual(['a.txt']);
  });

  it("takes one's own words in place of a single choice, and beside several", () => {
    const picked = togglePick(single, NO_PICK, 'syncQueue');
    expect(typeOther(single, picked, 'queue')).toEqual({ chosen: [], other: 'queue' });
    expect(typeOther(single, picked, ' ')).toEqual({ chosen: ['syncQueue'], other: ' ' });
    const some = togglePick(multi, NO_PICK, 'a.txt');
    expect(typeOther(multi, some, 'd.txt')).toEqual({ chosen: ['a.txt'], other: 'd.txt' });
    expect(togglePick(single, typeOther(single, NO_PICK, 'q'), 'syncQueue').other).toBe('');
  });

  it('joins several choices and the own words into one answer', () => {
    expect(answerOf({ chosen: ['a.txt', 'b.txt'], other: ' d.txt ' })).toBe('a.txt, b.txt, d.txt');
  });

  it('leaves the own words only the room the choices leave, so the answer fits as typed', () => {
    expect(otherRoom([])).toBe(RUN_REQUEST_ANSWER_MAX);
    expect(otherRoom(['a.txt', 'b.txt'])).toBe(RUN_REQUEST_ANSWER_MAX - 14);
    const long = typeOther(multi, NO_PICK, 'x'.repeat(RUN_REQUEST_ANSWER_MAX));
    const picked = togglePick(multi, long, 'a.txt');
    expect(picked.other).toHaveLength(RUN_REQUEST_ANSWER_MAX - 7);
    expect(answerOf(picked)).toHaveLength(RUN_REQUEST_ANSWER_MAX);
  });

  it('sends one answer for each question, only once every question has one', () => {
    const one = { chosen: ['syncQueue'], other: '' };
    const two = { chosen: [], other: 'Keep both' };
    expect(questionAnswers([one, two])).toEqual({
      decision: 'allow',
      answers: ['syncQueue', 'Keep both'],
    });
    expect(questionAnswers([one, NO_PICK])).toBeNull();
    expect(questionAnswers([{ chosen: [], other: '  ' }])).toBeNull();
    expect(questionAnswers([])).toBeNull();
  });
});

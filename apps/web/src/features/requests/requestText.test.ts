import { describe, expect, it } from 'vitest';
import { makeQuestion, makeQuestionRequest, makeRequest } from '../../api/test/requestFixtures';
import {
  announcementOf,
  answerLines,
  labelParts,
  outcomeLines,
  requestOutcome,
  subjectOf,
} from './requestText';

const NOW = Date.now();
const color = makeQuestion({ question: 'Which color?', header: 'Color' });
const size = makeQuestion({ question: 'Which size?', header: '' });

describe('labelParts', () => {
  it('splits a command, a path or an address from its verb', () => {
    expect(labelParts('Run npm test -- --run')).toEqual({
      verb: 'Run',
      detail: 'npm test -- --run',
    });
    expect(labelParts('Edit apps/web/src/a.ts')).toEqual({
      verb: 'Edit',
      detail: 'apps/web/src/a.ts',
    });
    expect(labelParts('Fetch https://example.com/a')).toEqual({
      verb: 'Fetch',
      detail: 'https://example.com/a',
    });
  });

  it("splits an MCP call's arguments from its name, the first line", () => {
    expect(labelParts('Use github: merge_pull_request\nowner: octo\npull_number: 42')).toEqual({
      verb: 'Use github: merge_pull_request',
      detail: 'owner: octo\npull_number: 42',
    });
  });

  it('keeps any other label whole', () => {
    expect(labelParts('Use tracker: move_ticket PT-12')).toEqual({
      verb: 'Use tracker: move_ticket PT-12',
      detail: '',
    });
    expect(labelParts('Run')).toEqual({ verb: 'Run', detail: '' });
    expect(labelParts('Runner up')).toEqual({ verb: 'Runner up', detail: '' });
  });
});

describe('outcomes', () => {
  it('says what was decided on a permission', () => {
    const allowed = makeRequest({ status: 'answered', decision: 'allow', endedAt: NOW });
    expect(outcomeLines(allowed, NOW)).toEqual(['Allowed']);
    expect(outcomeLines({ ...allowed, decision: 'deny' }, NOW)).toEqual(['Denied']);
  });

  it('says No answer for a request that ended unanswered, also past its deadline', () => {
    expect(outcomeLines(makeRequest({ status: 'expired', endedAt: NOW }), NOW)).toEqual([
      'No answer',
    ]);
    expect(outcomeLines(makeRequest({ status: 'cancelled', endedAt: NOW }), NOW)).toEqual([
      'No answer',
    ]);
    expect(requestOutcome(makeRequest({ expiresAt: NOW }), NOW)).toBe('none');
  });

  it('shows the answer to one question, and each answer after its question for several', () => {
    const one = makeQuestionRequest([color], {
      status: 'answered',
      decision: 'allow',
      answers: ['Red'],
    });
    expect(outcomeLines(one, NOW)).toEqual(['Red']);
    const two = makeQuestionRequest([color, size], {
      status: 'answered',
      decision: 'allow',
      answers: ['Red', 'Large, Small'],
    });
    expect(answerLines(two)).toEqual(['Color: Red', 'Which size?: Large, Small']);
    const skipped = makeQuestionRequest([color], { status: 'answered', decision: 'deny' });
    expect(outcomeLines(skipped, NOW)).toEqual(['Skipped']);
  });
});

describe('what is read out', () => {
  it('names the step or the first question', () => {
    expect(announcementOf(makeRequest())).toBe('Claude asks for permission: Run npm test');
    const question = makeQuestionRequest([color, size]);
    expect(subjectOf(question)).toBe('Which color?');
    expect(announcementOf(question)).toBe('Claude asks you: Which color?');
  });
});

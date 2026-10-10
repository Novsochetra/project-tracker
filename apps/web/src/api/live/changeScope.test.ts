import { describe, expect, it } from 'vitest';
import { queryKeys } from '../queryKeys';
import {
  listItem,
  makeBoard,
  makeTicketDetail,
  otherProject,
  project,
  STATUS,
  summaryOf,
} from '../test/fixtures';
import { parseChangeEvent, parseRunEvent, parseRunStepEvent } from './changeEvent';
import { changeScope, EVERYTHING, isAffected, type CachedEntry } from './changeScope';

const entries: CachedEntry[] = [
  { queryKey: queryKeys.projects(), data: [summaryOf(project), summaryOf(otherProject)] },
  { queryKey: queryKeys.board('MOB'), data: makeBoard() },
  { queryKey: queryKeys.ticket('MOB-1'), data: makeTicketDetail() },
  { queryKey: queryKeys.ticket('MOB-3'), data: makeTicketDetail(listItem(3, STATUS.progress, 0)) },
  { queryKey: queryKeys.ticketPrompt('MOB-1'), data: { text: 'prompt', ticketCount: 1 } },
  { queryKey: queryKeys.people(), data: ['Dara'] },
];

const changed = (projectId: string | null, ticketId: string | null) =>
  changeScope({ projectId, ticketId }, entries);

describe('changeScope', () => {
  it('maps a ticket change to its project key and ticket key', () => {
    const scope = changed('p-mob', 't-1');
    expect(scope.all).toBe(false);
    expect([...scope.projectKeys]).toEqual(['MOB']);
    expect([...scope.ticketKeys]).toEqual(['MOB-1']);
  });

  it('finds the project from cached ticket data when the event has no project id', () => {
    expect([...changed(null, 't-3').projectKeys]).toEqual(['MOB']);
  });

  it('covers every cached ticket of the project for a project-level change', () => {
    const scope = changed('p-mob', null);
    expect([...scope.ticketKeys].sort()).toEqual(['MOB-1', 'MOB-2', 'MOB-3', 'MOB-4']);
  });

  it('matches nothing project-specific for ids that are not cached', () => {
    const scope = changed('p-unknown', 't-unknown');
    expect(scope.projectKeys.size).toBe(0);
    expect(scope.ticketKeys.size).toBe(0);
  });

  it('refreshes everything when the event names nothing', () => {
    expect(changed(null, null)).toBe(EVERYTHING);
  });
});

describe('isAffected', () => {
  const scope = changed('p-mob', 't-1');

  it('always refreshes the project list, the ready list and report previews', () => {
    expect(isAffected(queryKeys.projects(), scope)).toBe(true);
    expect(isAffected(queryKeys.ready(), scope)).toBe(true);
    expect(isAffected(queryKeys.ready(), changed('p-web', null))).toBe(true);
    expect(isAffected(queryKeys.reportPreview('TICKET: MOB-1'), scope)).toBe(true);
  });

  it('refreshes matching project and ticket queries only', () => {
    expect(isAffected(queryKeys.board('MOB'), scope)).toBe(true);
    expect(isAffected(queryKeys.projectPrompt('MOB'), scope)).toBe(true);
    expect(isAffected(queryKeys.ticket('MOB-1'), scope)).toBe(true);
    expect(isAffected(queryKeys.ticketPrompt('MOB-1'), scope)).toBe(true);
    expect(isAffected(queryKeys.board('WEB'), scope)).toBe(false);
    expect(isAffected(queryKeys.ticket('MOB-3'), scope)).toBe(false);
  });

  it('leaves session and meta alone, and people and helpers for full refreshes', () => {
    expect(isAffected(queryKeys.session(), EVERYTHING)).toBe(false);
    expect(isAffected(queryKeys.meta(), EVERYTHING)).toBe(false);
    expect(isAffected(queryKeys.people(), scope)).toBe(false);
    expect(isAffected(queryKeys.people(), EVERYTHING)).toBe(true);
    expect(isAffected(queryKeys.runners(), scope)).toBe(false);
    expect(isAffected(queryKeys.runners(), EVERYTHING)).toBe(true);
  });

  it("reads a run's steps again only for a full refresh, as after a reconnect", () => {
    expect(isAffected(queryKeys.runSteps('r-1'), scope)).toBe(false);
    expect(isAffected(queryKeys.runSteps('r-1'), EVERYTHING)).toBe(true);
  });
});

describe('parseChangeEvent', () => {
  it('reads change events', () => {
    expect(parseChangeEvent('{"type":"changed","projectId":"p","ticketId":null}')).toEqual({
      type: 'changed',
      projectId: 'p',
      ticketId: null,
    });
    expect(parseChangeEvent('{"type":"changed"}')).toEqual({
      type: 'changed',
      projectId: null,
      ticketId: null,
    });
  });

  it('ignores anything else', () => {
    expect(parseChangeEvent('not json')).toBeNull();
    expect(parseChangeEvent('{"type":"heartbeat"}')).toBeNull();
    expect(parseChangeEvent(42)).toBeNull();
  });
});

describe('parseRunEvent', () => {
  const run = {
    type: 'run',
    runId: 'r1',
    runnerId: null,
    projectId: 'p',
    ticketId: 't',
    chatId: null,
  };

  it('reads run events', () => {
    expect(parseRunEvent(JSON.stringify({ ...run, status: 'failed' }))).toEqual({
      ...run,
      status: 'failed',
    });
    expect(parseRunEvent(JSON.stringify({ ...run, runnerId: 'h1', status: 'queued' }))).toEqual({
      ...run,
      runnerId: 'h1',
      status: 'queued',
    });
  });

  it('reads an ask run, which names its chat instead of a ticket', () => {
    const ask = { ...run, ticketId: null, chatId: 'c1', status: 'done' };
    expect(parseRunEvent(JSON.stringify(ask))).toEqual(ask);
  });

  it('reads a run event from before chats as a ticket run', () => {
    const { chatId: _chatId, ...older } = run;
    expect(parseRunEvent(JSON.stringify({ ...older, status: 'done' }))).toEqual({
      ...run,
      status: 'done',
    });
  });

  it('ignores anything else', () => {
    expect(parseRunEvent(JSON.stringify({ ...run, status: 'lost' }))).toBeNull();
    expect(parseRunEvent(JSON.stringify({ ...run, ticketId: null, status: 'done' }))).toBeNull();
    expect(parseRunEvent('{"type":"changed","projectId":"p","ticketId":"t"}')).toBeNull();
    expect(parseRunEvent('not json')).toBeNull();
  });
});

describe('parseRunStepEvent', () => {
  const step = {
    type: 'run-step',
    runId: 'r1',
    projectId: 'p',
    ticketId: 't',
    chatId: null,
    count: 12,
  };

  it("reads step events of a ticket's run and of a chat's", () => {
    expect(parseRunStepEvent(JSON.stringify(step))).toEqual(step);
    const ask = { ...step, ticketId: null, chatId: 'c1' };
    expect(parseRunStepEvent(JSON.stringify(ask))).toEqual(ask);
  });

  it('ignores anything else', () => {
    expect(parseRunStepEvent(JSON.stringify({ ...step, type: 'run' }))).toBeNull();
    expect(parseRunStepEvent(JSON.stringify({ ...step, runId: '' }))).toBeNull();
    expect(parseRunStepEvent(JSON.stringify({ ...step, count: '12' }))).toBeNull();
    expect(parseRunStepEvent(JSON.stringify({ ...step, count: -1 }))).toBeNull();
    expect(parseRunStepEvent('not json')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { targetsOf } from './pending';
import { belongsToProject, projectOfQuery, queryKeys } from './queryKeys';

describe('queryKeys', () => {
  it('uses the canonical uppercase key', () => {
    expect(queryKeys.board('mob')).toEqual(queryKeys.board('MOB'));
    expect(queryKeys.ticket('mob-3')).toEqual(queryKeys.ticket('MOB-3'));
  });

  it('nests the board and questions under their project and ticket so one invalidation covers them', () => {
    expect(queryKeys.board('MOB').slice(0, 2)).toEqual(queryKeys.project('MOB'));
    expect(queryKeys.ticketQuestions('MOB-3').slice(0, 2)).toEqual(queryKeys.ticket('MOB-3'));
  });

  it('finds the project a cached query belongs to', () => {
    expect(projectOfQuery(queryKeys.board('MOB'))).toBe('MOB');
    expect(projectOfQuery(queryKeys.ticketQuestions('MOB-3'))).toBe('MOB');
    expect(projectOfQuery(queryKeys.projects())).toBeUndefined();
    expect(projectOfQuery(queryKeys.ready())).toBeUndefined();
    expect(belongsToProject(queryKeys.ticket('MOB-3'), 'mob')).toBe(true);
    expect(belongsToProject(queryKeys.ticket('MOBX-3'), 'MOB')).toBe(false);
  });
});

describe('targetsOf', () => {
  it('reads the project and ticket a mutation touches', () => {
    expect(targetsOf({ ticketKey: 'mob-3', input: {} })).toEqual({
      projectKey: 'MOB',
      ticketKey: 'MOB-3',
    });
    expect(targetsOf({ projectKey: 'web', ids: [] })).toEqual({
      projectKey: 'WEB',
      ticketKey: undefined,
    });
    expect(targetsOf({ token: 'x' })).toEqual({ projectKey: undefined, ticketKey: undefined });
    expect(targetsOf(undefined)).toEqual({ projectKey: undefined, ticketKey: undefined });
  });
});

import { describe, expect, it } from 'vitest';
import { makeBoard, otherProject, project, summaryOf } from '../test/fixtures';
import {
  appendProjectSummary,
  patchProjectSummary,
  removeProjectSummary,
  reorderProjectSummaries,
  withNextNum,
  withProject,
} from './projects';

describe('project list helpers', () => {
  const list = [summaryOf(project)];

  it('appends a new project once with empty counts', () => {
    const added = appendProjectSummary(list, otherProject);
    expect(added.map((item) => item.key)).toEqual(['MOB', 'WEB']);
    expect(added[1]).toMatchObject({ totalCount: 0, openCount: 0, doneCount: 0 });
    expect(appendProjectSummary(added, otherProject)).toBe(added);
  });

  it('removes by key and patches by id', () => {
    expect(removeProjectSummary(list, 'mob')).toEqual([]);
    const patched = patchProjectSummary(list, { ...project, name: 'Phone app' });
    expect(patched[0]).toMatchObject({ name: 'Phone app', totalCount: 4 });
  });
});

describe('withProject / withNextNum', () => {
  it('only patches data for the same project', () => {
    const board = makeBoard();
    expect(withProject(board, { ...project, repo: '~/new' }).project.repo).toBe('~/new');
    expect(withProject(board, otherProject)).toBe(board);
  });

  it('moves nextNum past a newly created ticket number', () => {
    expect(withNextNum(makeBoard(), 5).project.nextNum).toBe(6);
    const board = makeBoard();
    expect(withNextNum(board, 2)).toBe(board);
  });
});

describe('reorderProjectSummaries', () => {
  const third = summaryOf({ ...otherProject, id: 'p-app', key: 'APP' });
  const list = [summaryOf(project), summaryOf(otherProject), third];

  it('puts the projects in the order given', () => {
    const keys = reorderProjectSummaries(list, [third.id, project.id, otherProject.id]).map(
      (item) => item.key,
    );
    expect(keys).toEqual(['APP', 'MOB', 'WEB']);
  });

  it('keeps a project the order leaves out after the ones it names, and skips unknown ids', () => {
    const keys = reorderProjectSummaries(list, ['p-gone', otherProject.id, project.id]).map(
      (item) => item.key,
    );
    expect(keys).toEqual(['WEB', 'MOB', 'APP']);
  });
});

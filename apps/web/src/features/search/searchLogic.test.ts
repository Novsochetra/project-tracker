import { describe, expect, it } from 'vitest';
import { otherProject, project, summaryOf } from '../../api/test/fixtures';
import { highlightParts } from './highlight';
import { paletteItems, paletteSections, PROJECTS_SHOWN } from './paletteItems';
import { paletteAction, stepIndex } from './paletteKeys';
import { isPaletteShortcut, shortcutHint, type PaletteKey } from './paletteShortcut';
import { matchProjects } from './projectMatches';
import { rankTicketHits } from './rankHits';
import { searchHit } from './test/hits';

const press = (overrides: Partial<PaletteKey>): PaletteKey => ({
  key: 'k',
  code: 'KeyK',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  isComposing: false,
  ...overrides,
});

describe('isPaletteShortcut', () => {
  it('takes Command-K on Apple keyboards and Control-K elsewhere', () => {
    expect(isPaletteShortcut(press({ metaKey: true }), true)).toBe(true);
    expect(isPaletteShortcut(press({ ctrlKey: true }), true)).toBe(false);
    expect(isPaletteShortcut(press({ ctrlKey: true }), false)).toBe(true);
    expect(isPaletteShortcut(press({ metaKey: true }), false)).toBe(false);
    expect(isPaletteShortcut(press({ metaKey: true, key: 'K' }), true)).toBe(true);
  });

  it('ignores K alone, other modifiers, repeats and composing', () => {
    expect(isPaletteShortcut(press({}), true)).toBe(false);
    expect(isPaletteShortcut(press({ metaKey: true, shiftKey: true }), true)).toBe(false);
    expect(isPaletteShortcut(press({ metaKey: true, altKey: true }), true)).toBe(false);
    expect(isPaletteShortcut(press({ metaKey: true, repeat: true }), true)).toBe(false);
    expect(isPaletteShortcut(press({ metaKey: true, isComposing: true }), true)).toBe(false);
  });

  it("takes K's place on a non-Latin layout, and the letter on a Latin one", () => {
    expect(isPaletteShortcut(press({ metaKey: true, key: 'л' }), true)).toBe(true);
    expect(isPaletteShortcut(press({ metaKey: true, key: 't', code: 'KeyK' }), true)).toBe(false);
    expect(isPaletteShortcut(press({ metaKey: true, code: 'KeyV' }), true)).toBe(true);
  });

  it('names the shortcut for the platform', () => {
    expect(shortcutHint(true)).toBe('⌘K');
    expect(shortcutHint(false)).toBe('Ctrl K');
  });
});

describe('paletteAction and stepIndex', () => {
  const key = (k: string, ctrlKey = false) =>
    paletteAction({ key: k, ctrlKey, metaKey: false, altKey: false, isComposing: false });

  it('moves with the arrows and Control-N/P, opens with Enter', () => {
    expect(key('ArrowDown')).toBe('next');
    expect(key('n', true)).toBe('next');
    expect(key('ArrowUp')).toBe('previous');
    expect(key('p', true)).toBe('previous');
    expect(key('Enter')).toBe('open');
    expect(key('n')).toBeNull();
  });

  it('wraps around the list', () => {
    expect(stepIndex(2, 3, 1)).toBe(0);
    expect(stepIndex(0, 3, -1)).toBe(2);
    expect(stepIndex(-1, 3, 1)).toBe(0);
    expect(stepIndex(-1, 3, -1)).toBe(2);
    expect(stepIndex(0, 0, 1)).toBe(-1);
  });
});

describe('highlightParts', () => {
  it('marks every match of every word, merged where they touch', () => {
    expect(highlightParts('Crash on rotate, crash', ['crash', 'on'])).toEqual([
      { text: 'Crash', hit: true },
      { text: ' ', hit: false },
      { text: 'on', hit: true },
      { text: ' rotate, ', hit: false },
      { text: 'crash', hit: true },
    ]);
    expect(highlightParts('abc', ['ab', 'bc'])).toEqual([{ text: 'abc', hit: true }]);
  });

  it('leaves text without a match, or whose lowercase is longer, as one part', () => {
    expect(highlightParts('Plain', ['x'])).toEqual([{ text: 'Plain', hit: false }]);
    expect(highlightParts('İstanbul', ['stan'])).toEqual([{ text: 'İstanbul', hit: false }]);
    expect(highlightParts('', ['x'])).toEqual([]);
  });
});

describe('matchProjects', () => {
  const tracker = { ...summaryOf(project), id: 'p-pt', name: 'Project tracker', key: 'PT' };
  const secret = { ...tracker, id: 'p-sec', name: 'Secret plan', key: 'SEC', hideName: true };
  const all = [summaryOf(project), summaryOf(otherProject), tracker, secret];

  it('lists every project for an empty query', () => {
    expect(matchProjects(all, '  ')).toEqual(all);
  });

  it('matches every word in the name or key, the key itself first', () => {
    expect(matchProjects(all, 'pt').map((p) => p.key)).toEqual(['PT']);
    expect(matchProjects(all, 'app mob').map((p) => p.key)).toEqual(['MOB']);
    expect(matchProjects(all, 'web').map((p) => p.key)).toEqual(['WEB']);
    expect(matchProjects(all, 'project').map((p) => p.key)).toEqual(['PT', 'SEC']);
  });

  it('never matches a hidden name', () => {
    expect(matchProjects(all, 'secret')).toEqual([]);
  });
});

describe('rankTicketHits', () => {
  it('orders key, title, description, then puts the open project first in each', () => {
    const hits = [
      searchHit('WEB-3', { match: 'description' }),
      searchHit('WEB-1', { match: 'title' }),
      searchHit('MOB-2', { match: 'description' }),
      searchHit('MOB-1', { match: 'title' }),
      searchHit('WEB-9', { match: 'key' }),
    ];
    expect(rankTicketHits(hits, 'mob').map((hit) => hit.key)).toEqual([
      'WEB-9',
      'MOB-1',
      'WEB-1',
      'MOB-2',
      'WEB-3',
    ]);
    expect(rankTicketHits(hits, null).map((hit) => hit.key)).toEqual([
      'WEB-9',
      'WEB-1',
      'MOB-1',
      'WEB-3',
      'MOB-2',
    ]);
  });
});

describe('paletteSections', () => {
  const projects = [summaryOf(project), summaryOf(otherProject)];

  it('shows projects, then recent tickets, for an empty query', () => {
    const hits = [searchHit('MOB-1', { match: 'recent' })];
    const sections = paletteSections({ projects, hits, query: '', currentProjectKey: null });
    expect(sections.map((section) => section.label)).toEqual(['Projects', 'Recent tickets']);
    expect(paletteItems(sections).map((item) => item.route)).toEqual([
      { name: 'project', key: 'MOB' },
      { name: 'project', key: 'WEB' },
      { name: 'ticket', key: 'MOB', num: 1 },
    ]);
  });

  it('puts a key match above the projects and leaves out empty groups', () => {
    const hits = [searchHit('WEB-2', { match: 'key' })];
    const sections = paletteSections({ projects, hits, query: 'web 2', currentProjectKey: null });
    expect(sections.map((section) => section.label)).toEqual(['Tickets']);
    const web = paletteSections({ projects, hits, query: 'web', currentProjectKey: null });
    expect(web.map((section) => section.label)).toEqual(['Tickets', 'Projects']);
  });

  it('shows a few projects at most', () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      ...summaryOf(project),
      id: `p-${index}`,
      key: `K${index}`,
    }));
    const [first] = paletteSections({
      projects: many,
      hits: [],
      query: '',
      currentProjectKey: null,
    });
    expect(first?.items).toHaveLength(PROJECTS_SHOWN);
  });
});

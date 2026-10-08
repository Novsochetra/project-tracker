import { describe, expect, it } from 'vitest';
import { firstLoadProblems, readFirstLoad, type Manifest } from './firstLoad';

// The shape of a real build's manifest (vite build --manifest), cut down.
const SPLIT: Manifest = {
  'index.html': {
    file: 'assets/index-1.js',
    isEntry: true,
    imports: ['_shared-1.js'],
    dynamicImports: ['src/ProjectScreen.tsx', 'src/ConnectSheet.tsx'],
  },
  '_shared-1.js': { file: 'assets/shared-1.js' },
  '_copy-1.js': { file: 'assets/copy-1.js', imports: ['_shared-1.js'] },
  'src/ProjectScreen.tsx': {
    file: 'assets/ProjectScreen-1.js',
    imports: ['_shared-1.js', 'index.html'],
    dynamicImports: ['src/NewTicketSheet.tsx'],
  },
  'src/NewTicketSheet.tsx': {
    file: 'assets/NewTicketSheet-1.js',
    imports: ['index.html'],
  },
  'src/ConnectSheet.tsx': {
    file: 'assets/ConnectSheet-1.js',
    imports: ['_copy-1.js', 'index.html'],
  },
};

// What the build writes when main.tsx also imports ProjectScreen statically: the screen's code
// joins the entry, and the dynamic import that meant to load it later points at the entry.
const TAKEN: Manifest = {
  ...SPLIT,
  'index.html': {
    ...SPLIT['index.html']!,
    dynamicImports: ['index.html', 'src/ConnectSheet.tsx'],
  },
};
delete TAKEN['src/ProjectScreen.tsx'];

describe('readFirstLoad', () => {
  it('takes the entry and what it imports, not what it imports dynamically', () => {
    expect(readFirstLoad(SPLIT).files).toEqual(['assets/index-1.js', 'assets/shared-1.js']);
  });

  it('finds every lazy part reachable from the entry, also one that a lazy part loads', () => {
    expect(readFirstLoad(SPLIT).lazyParts).toEqual([
      'src/ProjectScreen.tsx',
      'src/ConnectSheet.tsx',
      'src/NewTicketSheet.tsx',
    ]);
    expect(readFirstLoad(SPLIT).taken).toEqual([]);
  });

  it('finds a lazy part that the first load takes in because something imports it statically', () => {
    expect(readFirstLoad(TAKEN).taken).toEqual(['assets/index-1.js']);
  });

  it('finds a lazy part that shares a chunk the entry imports', () => {
    const shared: Manifest = {
      ...SPLIT,
      'index.html': { ...SPLIT['index.html']!, dynamicImports: ['_shared-1.js'] },
    };
    expect(readFirstLoad(shared).taken).toEqual(['assets/shared-1.js']);
  });

  it('fails without an entry', () => {
    expect(() => readFirstLoad({ '_shared-1.js': { file: 'assets/shared-1.js' } })).toThrow(
      'no entry',
    );
  });
});

describe('firstLoadProblems', () => {
  const sizes = (kB: number, maxFiles = 3) => ({ kB, budgetKB: 215, maxFiles });

  it('has none for a split build within its budget', () => {
    expect(firstLoadProblems(readFirstLoad(SPLIT), sizes(206.5))).toEqual([]);
  });

  it('reports a first load past its budget', () => {
    expect(firstLoadProblems(readFirstLoad(SPLIT), sizes(215.1))).toEqual([
      'First-load JS is past its 215 kB budget: load more of it when its screen or sheet opens, or raise the budget.',
    ]);
  });

  it('reports a first load split into more files than it allows', () => {
    expect(firstLoadProblems(readFirstLoad(SPLIT), sizes(206.5, 1))).toEqual([
      'First-load JS is 2 files, more than 1: code the first screen shares stopped folding into ' +
        'the entry. A likely cause is a barrel the first load imports that re-exports a module ' +
        'only a lazy part uses; import that module directly instead.',
    ]);
  });

  it('reports a lazy part loaded at start by the file that holds it', () => {
    expect(firstLoadProblems(readFirstLoad(TAKEN), sizes(206.5))).toEqual([
      "Loaded at start but meant to load when opened: a dynamic import of assets/index-1.js, which the first load holds. Something there imports the part statically; Vite's INEFFECTIVE_DYNAMIC_IMPORT warning above names it.",
    ]);
  });
});

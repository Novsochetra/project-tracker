import { describe, expect, it } from 'vitest';
import { addToChangelog, changelogEntry } from './changelog';

const entry = changelogEntry('1.1.0', '2026-10-14', ['Show the version (PT-182)', 'Fix a typo']);

describe('changelogEntry', () => {
  it('lists the commit subjects under the version and day', () => {
    expect(entry).toBe('## v1.1.0 (2026-10-14)\n\n- Show the version (PT-182)\n- Fix a typo\n');
  });
});

describe('addToChangelog', () => {
  it('starts a changelog when there is none', () => {
    expect(addToChangelog(null, entry)).toBe(`# Changelog\n\n${entry}`);
    expect(addToChangelog('\n', entry)).toBe(`# Changelog\n\n${entry}`);
  });

  it('puts the new entry above the previous release, below the intro', () => {
    const existing = '# Changelog\n\nIntro.\n\n## v1.0.0 (2026-10-13)\n\n- First\n';
    expect(addToChangelog(existing, entry)).toBe(
      `# Changelog\n\nIntro.\n\n${entry}\n## v1.0.0 (2026-10-13)\n\n- First\n`,
    );
  });

  it('adds the first entry after the intro', () => {
    expect(addToChangelog('# Changelog\n\nIntro.\n', entry)).toBe(
      `# Changelog\n\nIntro.\n\n${entry}`,
    );
  });
});

import { describe, expect, it } from 'vitest';
import { cutTo } from '../../src/logic/runSteps/cut';
import { shownPath } from '../../src/logic/runSteps/paths';
import { toolLabel } from '../../src/logic/runSteps/toolLabel';

const FOLDER = '/work/app';

const labelOf = (name: string, input: Record<string, unknown>) => toolLabel(name, input, FOLDER);

describe('toolLabel', () => {
  it('says what Claude asks to do, with paths from the project folder', () => {
    expect(labelOf('Read', { file_path: `${FOLDER}/a/b.ts` })).toBe('Read a/b.ts');
    expect(labelOf('Write', { file_path: '/etc/hosts' })).toBe('Write /etc/hosts');
    expect(labelOf('MultiEdit', { file_path: `${FOLDER}-other/x.ts` })).toBe(
      `Edit ${FOLDER}-other/x.ts`,
    );
    expect(labelOf('NotebookEdit', { notebook_path: `${FOLDER}/n.ipynb`, new_source: 's' })).toBe(
      'Edit n.ipynb',
    );
    expect(labelOf('Grep', { pattern: 'foo', path: `${FOLDER}/src` })).toBe(
      "Search for 'foo' in src",
    );
    expect(labelOf('Glob', { pattern: '**/*.ts', path: FOLDER })).toBe(
      "Find files matching '**/*.ts' in .",
    );
  });

  it("shows a command's first line only, since a heredoc's body is a file", () => {
    const command = "cat > notes.md <<'EOF'\nSECRET\nEOF";
    expect(labelOf('Bash', { command })).toBe("Run cat > notes.md <<'EOF' …");
  });

  it('drops the query of a fetched address, and names other tools', () => {
    expect(labelOf('WebFetch', { url: 'https://x.dev/a?token=SECRET#b', prompt: 'p' })).toBe(
      'Fetch https://x.dev/a',
    );
    expect(labelOf('WebSearch', { query: 'zod 4' })).toBe("Search the web for 'zod 4'");
    expect(labelOf('TodoWrite', { todos: [{ content: 'SECRET' }] })).toBe('Update the to-do list');
    expect(labelOf('Skill', { skill: 'review' })).toBe('Use the skill review');
    expect(labelOf('AskUserQuestion', { questions: 'odd' })).toBe('Ask:');
    expect(labelOf('LSP', { file: 'x' })).toBe('Use LSP');
    expect(labelOf('Read', {})).toBe('Read');
  });

  it("shows an MCP tool's ticket or project key, never its free text", () => {
    expect(labelOf('mcp__tracker__claim_next_ticket', { project: 'PT' })).toBe(
      'Use tracker: claim_next_ticket PT',
    );
    expect(labelOf('mcp__tracker__add_comment', { ticket: 'PT-3', text: 'SECRET' })).toBe(
      'Use tracker: add_comment PT-3',
    );
    expect(labelOf('mcp__tracker__add_comment', { ticket: 'not a key', project: 'a b' })).toBe(
      'Use tracker: add_comment',
    );
    expect(labelOf('mcp__my_server__do__it', {})).toBe('Use my_server: do__it');
  });
});

describe('shownPath and cutTo', () => {
  it('keeps a path outside the folder whole', () => {
    expect(shownPath(`${FOLDER}/x`, `${FOLDER}/`)).toBe('x');
    expect(shownPath('relative/x.ts', FOLDER)).toBe('relative/x.ts');
  });

  it('never ends on half an emoji', () => {
    expect(cutTo('ab😀cd', 4)).toBe('ab…');
    expect(cutTo('abc', 3)).toBe('abc');
  });
});

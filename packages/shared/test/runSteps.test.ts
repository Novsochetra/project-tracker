import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RUN_STEP_LABEL_MAX, RUN_STEP_TEXT_MAX } from '../src/domain/runStep';
import { cutTo } from '../src/logic/runSteps/cut';
import { shownPath } from '../src/logic/runSteps/paths';
import { stepsOfEvent } from '../src/logic/runSteps/stepsOfEvent';
import { toolLabel } from '../src/logic/runSteps/toolLabel';

const FOLDER = '/Users/dara/code/app';

// Lines in the shape claude -p --output-format stream-json --verbose prints them.
const sample = readFileSync(new URL('./fixtures/stream-json.jsonl', import.meta.url), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line) as unknown);

const toolUse = (name: string, input: unknown, parent: string | null = null) => ({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name, input }] },
  parent_tool_use_id: parent,
});

const labelOf = (name: string, input: Record<string, unknown>) => toolLabel(name, input, FOLDER);

describe('stepsOfEvent', () => {
  it('turns a real run into short steps, sub agent steps marked', () => {
    expect(sample.flatMap((event) => stepsOfEvent(event, FOLDER))).toEqual([
      { kind: 'text', label: "I'll claim the ticket first.", subAgent: false },
      { kind: 'tool', label: 'Used tracker: claim_ticket PT-12', subAgent: false },
      { kind: 'tool', label: 'Read apps/web/src/login.ts', subAgent: false },
      { kind: 'agent', label: 'Started sub agent: Find the session store', subAgent: false },
      { kind: 'tool', label: "Searched for 'sessionStore' in apps/server", subAgent: true },
      { kind: 'tool', label: 'Edited apps/server/src/sessionStore.ts', subAgent: false },
      { kind: 'tool', label: 'Ran npm run verify', subAgent: false },
      {
        kind: 'text',
        label: expect.stringMatching(
          /^Fixed the crash: sessions now expire\.\n\n```\nTICKET: PT-12/,
        ),
        subAgent: false,
      },
    ]);
  });

  it('never carries tool output, file contents, edits or thinking', () => {
    const sent = JSON.stringify(sample.flatMap((event) => stepsOfEvent(event, FOLDER)));
    expect(sent).not.toMatch(/SECRET|session code|report back/);
  });

  it('makes nothing of events that are not Claude speaking or calling a tool', () => {
    for (const event of [null, 'text', 42, [], { type: 'assistant' }, { type: 'result' }]) {
      expect(stepsOfEvent(event, FOLDER)).toEqual([]);
    }
    const odd = { type: 'assistant', message: { content: [null, { type: 'text', text: '  ' }] } };
    expect(stepsOfEvent(odd, FOLDER)).toEqual([]);
  });

  it('cuts every label to one short line and long words to the text cap', () => {
    const [tool] = stepsOfEvent(toolUse('Bash', { command: `echo ${'x'.repeat(400)}` }), FOLDER);
    expect(tool?.label).toHaveLength(RUN_STEP_LABEL_MAX);
    expect(tool?.label.endsWith('…')).toBe(true);
    const long = {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'y'.repeat(9000) }] },
    };
    expect(stepsOfEvent(long, FOLDER)[0]?.label).toHaveLength(RUN_STEP_TEXT_MAX);
  });

  it('names a sub agent by its description, from the Task tool of older versions too', () => {
    expect(
      stepsOfEvent(toolUse('Task', { description: 'Review it', prompt: 'p' }), FOLDER),
    ).toEqual([{ kind: 'agent', label: 'Started sub agent: Review it', subAgent: false }]);
    expect(stepsOfEvent(toolUse('Read', 'not an object', 'toolu_9'), FOLDER)).toEqual([
      { kind: 'tool', label: 'Read', subAgent: true },
    ]);
  });
});

describe('toolLabel', () => {
  it('shows paths from the project folder, and others as they are', () => {
    expect(labelOf('Read', { file_path: `${FOLDER}/a/b.ts` })).toBe('Read a/b.ts');
    expect(labelOf('Write', { file_path: '/etc/hosts' })).toBe('Wrote /etc/hosts');
    expect(labelOf('MultiEdit', { file_path: `${FOLDER}-other/x.ts` })).toBe(
      `Edited ${FOLDER}-other/x.ts`,
    );
    expect(labelOf('NotebookEdit', { notebook_path: `${FOLDER}/n.ipynb`, new_source: 's' })).toBe(
      'Edited n.ipynb',
    );
    expect(labelOf('Glob', { pattern: '**/*.ts', path: FOLDER })).toBe(
      "Found files matching '**/*.ts' in .",
    );
  });

  it("shows a command's first line only, since a heredoc's body is a file", () => {
    const command = "cat > notes.md <<'EOF'\nSECRET\nEOF";
    expect(labelOf('Bash', { command })).toBe("Ran cat > notes.md <<'EOF' …");
  });

  it('drops the query of a fetched address, and names other tools', () => {
    expect(labelOf('WebFetch', { url: 'https://x.dev/a?token=SECRET#b', prompt: 'p' })).toBe(
      'Fetched https://x.dev/a',
    );
    expect(labelOf('WebSearch', { query: 'zod 4' })).toBe("Searched the web for 'zod 4'");
    expect(labelOf('TodoWrite', { todos: [{ content: 'SECRET' }] })).toBe('Updated the to-do list');
    expect(labelOf('Skill', { skill: 'review' })).toBe('Used the skill review');
    expect(labelOf('LSP', { file: 'x' })).toBe('Used LSP');
    expect(labelOf('Read', {})).toBe('Read');
  });

  it("shows an MCP tool's ticket or project key, never its free text", () => {
    expect(labelOf('mcp__tracker__claim_next_ticket', { project: 'PT' })).toBe(
      'Used tracker: claim_next_ticket PT',
    );
    expect(labelOf('mcp__tracker__add_comment', { ticket: 'PT-3', text: 'SECRET' })).toBe(
      'Used tracker: add_comment PT-3',
    );
    expect(labelOf('mcp__tracker__add_comment', { ticket: 'not a key', project: 'a b' })).toBe(
      'Used tracker: add_comment',
    );
    expect(labelOf('mcp__my_server__do__it', {})).toBe('Used my_server: do__it');
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

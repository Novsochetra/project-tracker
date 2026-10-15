import { describe, expect, it } from 'vitest';
import { RUN_STEP_LABEL_MAX, RUN_STEP_TEXT_MAX, type RunStepInput } from '../../src/domain/runStep';
import { createStepReader } from '../../src/logic/runSteps/stepReader';
import { STREAM_FOLDER, STREAMS, streamEvents } from '../fixtures/streamJson';

type Name = (typeof STREAMS)[number];

const stepsOf = (events: unknown[]): RunStepInput[] => {
  const read = createStepReader(STREAM_FOLDER);
  return events.flatMap((event) => read(event));
};

const short = (steps: RunStepInput[]) =>
  steps.map(
    ({ kind, label, subAgent }) => `${kind}${subAgent ? ' sub' : ''}: ${label.split('\n')[0]}`,
  );

const strings = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : typeof value === 'object' && value !== null
      ? Object.values(value).flatMap(strings)
      : [];

type Block = Record<string, unknown>;

const blocksOf = (event: unknown): Block[] => {
  const content = (event as { message?: { content?: unknown } }).message?.content;
  return Array.isArray(content) ? (content as Block[]) : [];
};

// tool_use_result also repeats the call's own input (a question, a description), which is shown.
const OUTPUT_FIELDS = ['stdout', 'stderr', 'content', 'answers', 'handback', 'prompt', 'file'];
const outputOf = (result: unknown): unknown =>
  typeof result === 'object' && result !== null
    ? OUTPUT_FIELDS.map((field) => (result as Block)[field])
    : result;

// What must stay on the computer: tool results, thinking, and what a call writes or tells a sub
// agent.
function privateTexts(events: unknown[]): string[] {
  return events
    .flatMap((event) => [
      ...strings(outputOf((event as Block).tool_use_result)),
      ...blocksOf(event).flatMap((block) => {
        if (block.type === 'tool_result') return strings(block.content);
        if (block.type === 'thinking') return strings(block.thinking);
        if (block.type !== 'tool_use') return [];
        const { content, prompt, message, new_string: added } = block.input as Block;
        return strings([content, prompt, message, added]);
      }),
    ])
    .filter((text) => text.trim().length > 6);
}

const claudesWords = (events: unknown[]): string[] =>
  events.flatMap((event) =>
    (event as Block).type === 'assistant'
      ? blocksOf(event).flatMap((block) => (block.type === 'text' ? strings(block.text) : []))
      : [],
  );

describe('createStepReader on real Claude Code runs', () => {
  it('shows a command the person denied as asked, then not allowed', () => {
    for (const name of ['denied-by-person', 'denied-by-hook'] as const) {
      const steps = stepsOf(streamEvents(name));
      expect(short(steps)).toEqual([
        'tool: Run echo hello > out.txt',
        'denied: Not allowed: Run echo hello > out.txt',
        expect.stringMatching(/^text: The command was denied\./),
      ]);
      expect(steps[1]?.toolId).toBe(steps[0]?.toolId);
      expect(steps[0]?.toolId).toMatch(/^toolu_/);
    }
  });

  it('names a question Claude asks, and a call that ran stays as asked', () => {
    expect(short(stepsOf(streamEvents('ask-user-question')))).toEqual([
      'tool: Ask: Which file name should I use?',
      'tool: Run echo hello > b.txt',
      'text: Done. I wrote `hello` into `b.txt`.',
    ]);
  });

  it("marks a sub agent's steps and shows its refused calls", () => {
    expect(short(stepsOf(streamEvents('background-sub-agent')))).toEqual([
      'agent: Start sub agent: List the folder',
      'text: I started the sub agent. It is running now. I will tell you what it found when it finishes.',
      expect.stringMatching(/^tool sub: Run ls -la /),
      expect.stringMatching(/^denied sub: Not allowed: Run ls -la /),
      expect.stringMatching(/^tool sub: Read .*a\.txt$/),
      expect.stringMatching(/^denied sub: Not allowed: Read .*a\.txt$/),
      'text sub: I could not complete either step. The permission system denied both tools I needed, so I did not try a workaround.',
      'text: The sub agent could not run. Its tools were blocked by permissions.',
    ]);
  });

  it('shows paths in the folder from it, and a call that failed is no refusal', () => {
    expect(short(stepsOf(streamEvents('sub-agent')))).toEqual([
      'agent: Start sub agent: Read hello.txt first line',
      expect.stringMatching(/^tool sub: Read \/tmp\/.*hello\.txt$/),
      'tool sub: Read hello.txt',
      'tool sub: Use SubagentHandback',
      'text: The sub agent read `hello.txt`. Its first line is: `SECRET_FILE_LINE from hello.txt`',
    ]);
  });

  it.each(STREAMS)(
    'never sends what a tool gave back, thinking or what a call carries (%s)',
    (name: Name) => {
      const events = streamEvents(name);
      const steps = stepsOf(events);
      const labels = JSON.stringify(steps.filter(({ kind }) => kind !== 'text'));
      const hidden = privateTexts(events);
      expect(hidden.length).toBeGreaterThan(0);
      for (const text of hidden) expect(labels).not.toContain(JSON.stringify(text).slice(1, -1));
      // Claude's own words may quote anything; they are its words, not a tool's output.
      const words = claudesWords(events).map((text) => text.trim());
      for (const { label } of steps.filter(({ kind }) => kind === 'text')) {
        expect(words).toContain(label);
      }
    },
  );
});

const toolUse = (name: string, input: unknown, id = 'toolu_1', parent: string | null = null) => ({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
  parent_tool_use_id: parent,
});

describe('createStepReader', () => {
  it('makes nothing of events that are not Claude speaking, asking for a tool or refused', () => {
    const read = createStepReader(STREAM_FOLDER);
    for (const event of [null, 'text', 42, [], { type: 'assistant' }, { type: 'result' }]) {
      expect(read(event)).toEqual([]);
    }
    const odd = { type: 'assistant', message: { content: [null, { type: 'text', text: '  ' }] } };
    expect(read(odd)).toEqual([]);
  });

  it('says a call was not allowed once, whichever event says it first', () => {
    const read = createStepReader(STREAM_FOLDER);
    read(toolUse('Bash', { command: 'rm -rf build' }, 'toolu_9', 'toolu_agent'));
    const event = { type: 'system', subtype: 'permission_denied', tool_use_id: 'toolu_9' };
    expect(read(event)).toEqual([
      {
        kind: 'denied',
        label: 'Not allowed: Run rm -rf build',
        subAgent: true,
        parentToolId: 'toolu_agent',
        toolId: 'toolu_9',
      },
    ]);
    const result = {
      type: 'user',
      message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_9', is_error: true }] },
      tool_result_meta: [{ id: 'toolu_9', permission_decision: { decision: 'reject' } }],
    };
    expect(read(result)).toEqual([]);
    expect(read({ ...event, tool_use_id: 'toolu_unknown' })).toEqual([]);
  });

  it('cuts every label to one short line and long words to the text cap', () => {
    const read = createStepReader(STREAM_FOLDER);
    const [tool] = read(toolUse('Bash', { command: `echo ${'x'.repeat(400)}` }));
    expect(tool?.label).toHaveLength(RUN_STEP_LABEL_MAX);
    expect(tool?.label.endsWith('…')).toBe(true);
    const long = {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'y'.repeat(9000) }] },
    };
    expect(read(long)[0]).toMatchObject({ label: expect.any(String), toolId: null });
    expect(read(long)[0]?.label).toHaveLength(RUN_STEP_TEXT_MAX);
  });

  it('names a sub agent by its description, from the Task tool of older versions too', () => {
    const read = createStepReader(STREAM_FOLDER);
    expect(read(toolUse('Task', { description: 'Review it', prompt: 'p' }))).toEqual([
      { kind: 'agent', label: 'Start sub agent: Review it', subAgent: false, toolId: 'toolu_1' },
    ]);
    expect(read(toolUse('Read', 'not an object', 'toolu_2', 'toolu_1'))).toEqual([
      { kind: 'tool', label: 'Read', subAgent: true, parentToolId: 'toolu_1', toolId: 'toolu_2' },
    ]);
  });

  it("masks a secret on a command line, and in Claude's words about it", () => {
    const read = createStepReader(STREAM_FOLDER);
    const [step] = read(toolUse('Bash', { command: 'GITHUB_TOKEN=ghp_abc123 gh pr list' }));
    expect(step?.label).toBe('Run GITHUB_TOKEN=*** gh pr list');
    const said = 'I ran `export GITHUB_TOKEN=ghp_abc123` first.';
    const words = { type: 'assistant', message: { content: [{ type: 'text', text: said }] } };
    expect(read(words)[0]?.label).toBe('I ran `export GITHUB_TOKEN=***` first.');
  });

  it('masks a long secret whole, past where a step is cut', () => {
    const read = createStepReader(STREAM_FOLDER);
    const token = 'eyJhbGciOiJIUzI1NiJ9'.repeat(45);
    const [step] = read(toolUse('Bash', { command: `export TOKEN="${token.slice(0, 700)}"` }));
    expect(step?.label).toBe('Run export TOKEN=***');
    const said = `I sent Authorization: Bearer ${token} and it worked.`;
    const words = { type: 'assistant', message: { content: [{ type: 'text', text: said }] } };
    expect(read(words)[0]?.label).toBe('I sent Authorization: Bearer *** and it worked.');
  });
});

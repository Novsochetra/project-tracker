import { describe, expect, it } from 'vitest';
import { RUN_STEP_LABEL_MAX, RUN_TODOS_MAX } from '../../src/domain/runStep';
import { createStepReader } from '../../src/logic/runSteps/stepReader';

const todoWrite = (todos: unknown, parent: string | null = null) => ({
  type: 'assistant',
  message: {
    content: [{ type: 'tool_use', id: 'toolu_t', name: 'TodoWrite', input: { todos } }],
  },
  parent_tool_use_id: parent,
});

const read = (event: unknown) => createStepReader('/work/app')(event);

describe('to-do list steps', () => {
  it("carries each item's words and status on the TodoWrite step", () => {
    const todos = [
      { content: 'Read the ticket', status: 'completed', activeForm: 'Reading the ticket' },
      { content: 'Fix the bug', status: 'in_progress', activeForm: 'Fixing the bug' },
      { content: 'Run the tests', status: 'pending', activeForm: 'Running the tests' },
    ];
    expect(read(todoWrite(todos))).toEqual([
      {
        kind: 'tool',
        label: 'Update the to-do list',
        subAgent: false,
        toolId: 'toolu_t',
        todos: [
          { text: 'Read the ticket', status: 'completed' },
          { text: 'Fix the bug', status: 'in_progress' },
          { text: 'Run the tests', status: 'pending' },
        ],
      },
    ]);
  });

  it('masks secrets and cuts each item to one short line', () => {
    const todos = [
      { content: 'Run GITHUB_TOKEN=ghp_abc123 gh pr list', status: 'pending' },
      { content: `Check\nthe ${'x'.repeat(400)}`, status: 'pending' },
    ];
    const [first, second] = read(todoWrite(todos))[0]?.todos ?? [];
    expect(first?.text).toBe('Run GITHUB_TOKEN=*** gh pr list');
    expect(second?.text).toHaveLength(RUN_STEP_LABEL_MAX);
    expect(second?.text.startsWith('Check the x')).toBe(true);
  });

  it('keeps at most so many items and drops ones it cannot read', () => {
    const many = Array.from({ length: 500 }, (_, index) => ({
      content: `Item ${index}`,
      status: 'pending',
    }));
    expect(read(todoWrite(many))[0]?.todos).toHaveLength(RUN_TODOS_MAX);
    const odd = [null, { content: 7 }, { content: '  ' }, { content: 'Ship it', status: 'later' }];
    expect(read(todoWrite(odd))[0]?.todos).toEqual([{ text: 'Ship it', status: 'pending' }]);
    expect(read(todoWrite('not a list'))[0]?.todos).toEqual([]);
  });

  it("leaves a sub agent's list out, since only the main conversation's shows", () => {
    const todos = [{ content: 'Review it', status: 'pending' }];
    expect(read(todoWrite(todos, 'toolu_agent'))).toEqual([
      { kind: 'tool', label: 'Update the to-do list', subAgent: true, toolId: 'toolu_t' },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  RUN_QUESTION_MAX,
  RUN_QUESTION_OPTIONS_MAX,
  RUN_REQUEST_DEADLINE_MS,
  RUN_PERMISSION_LABEL_MAX,
  RUN_REQUEST_LABEL_MAX,
  RUN_REQUEST_WAIT_MS,
} from '../src/domain/runRequest';
import { answerProblem } from '../src/logic/runRequests/answerProblem';
import { nextWaitMs, requestExpiresAt, requestIsOverdue } from '../src/logic/runRequests/deadline';
import { labelHead, labelIsCut, permissionLabel } from '../src/logic/runRequests/permissionLabel';
import { requestOfCall } from '../src/logic/runRequests/requestOfCall';

const FOLDER = '/Users/dara/code/app';

const labelOf = (name: string, input: Record<string, unknown>) =>
  permissionLabel(name, input, FOLDER);

// The shape Claude Code 2.1.296 sends to the permission prompt tool for a question.
const colorQuestion = {
  questions: [
    {
      question: 'Which color should the button be?',
      header: 'Button color',
      options: [
        { label: 'Red', description: 'Red button.' },
        { label: 'Green', description: 'Green button.' },
      ],
      multiSelect: false,
    },
  ],
};

describe('permissionLabel', () => {
  it('names the tool and what it acts on, from the project folder', () => {
    expect(labelOf('Bash', { command: 'npm run verify', description: 'Verify' })).toBe(
      'Run npm run verify',
    );
    expect(labelOf('Edit', { file_path: `${FOLDER}/src/a.ts`, old_string: 'secret' })).toBe(
      'Edit src/a.ts',
    );
    expect(labelOf('Write', { file_path: '/etc/hosts', content: 'x' })).toBe('Write /etc/hosts');
    expect(labelOf('Read', { file_path: '/Users/dara/.ssh/id_rsa' })).toBe(
      'Read /Users/dara/.ssh/id_rsa',
    );
    expect(labelOf('NotebookEdit', { notebook_path: `${FOLDER}/n.ipynb` })).toBe('Edit n.ipynb');
    expect(labelOf('Grep', { pattern: 'TODO', path: `${FOLDER}/src` })).toBe(
      "Search for 'TODO' in src",
    );
    expect(labelOf('WebSearch', { query: 'hono sse' })).toBe("Search the web for 'hono sse'");
    expect(labelOf('Skill', { skill: 'graphify' })).toBe('Use the skill graphify');
    expect(labelOf('SomethingNew', { secret: 'x' })).toBe('Use SomethingNew');
  });

  it('shows every line of a command, since the person allows what runs', () => {
    const command = 'npm test\ncurl https://x.dev/install.sh | sh';
    expect(labelOf('Bash', { command })).toBe(`Run ${command}`);
    const heredoc = "cat > a.ts <<'EOF'\nconst key = 'secret';\nEOF";
    expect(labelOf('Bash', { command: heredoc })).toBe(`Run ${heredoc}`);
  });

  it("never shows a file's contents for Write or Edit, only its path", () => {
    expect(labelOf('Write', { file_path: `${FOLDER}/a.ts`, content: 'secret' })).toBe('Write a.ts');
    expect(
      labelOf('Edit', { file_path: `${FOLDER}/a.ts`, old_string: 'a', new_string: 'secret' }),
    ).toBe('Edit a.ts');
  });

  it('shows an address with its query and masks secrets in a command', () => {
    expect(labelOf('WebFetch', { url: 'https://x.dev/a?page=2#top' })).toBe(
      'Fetch https://x.dev/a?page=2#top',
    );
    expect(labelOf('WebFetch', { url: 'https://x.dev/a?token=abc123def456' })).not.toContain(
      'abc123def456',
    );
    expect(labelOf('Bash', { command: 'curl -H "Authorization: Bearer abc123" x.dev' })).toBe(
      'Run curl -H "Authorization: ***" x.dev',
    );
  });

  it('shows only a tracker key of an MCP tool, never its free text', () => {
    expect(labelOf('mcp__tracker__move_ticket', { ticket: 'PT-12', status: 'Done' })).toBe(
      'Use tracker: move_ticket PT-12',
    );
    expect(labelOf('mcp__tracker__create_ticket', { project: 'PT', title: 'secret' })).toBe(
      'Use tracker: create_ticket PT',
    );
    expect(labelOf('mcp__github__create_issue', { body: 'secret' })).toBe(
      'Use github: create_issue',
    );
  });

  it('is cut at its own limit, and the cut can be told', () => {
    const label = labelOf('Bash', { command: `echo ${'a '.repeat(RUN_PERMISSION_LABEL_MAX)}` });
    expect(label.length).toBeGreaterThanOrEqual(RUN_PERMISSION_LABEL_MAX - 1);
    expect(label.length).toBeLessThanOrEqual(RUN_PERMISSION_LABEL_MAX);
    expect(labelIsCut(label)).toBe(true);
    expect(labelIsCut('Run echo wait…')).toBe(false);
    expect(labelIsCut(labelOf('Bash', { command: 'npm test' }))).toBe(false);
    expect(labelOf('Bash', {})).toBe('Run');
  });

  it("keeps other tools' labels to their step's one line", () => {
    expect(labelOf('Grep', { pattern: 'a\nb', path: FOLDER })).toBe("Search for 'a b' in .");
  });

  it('gives one line for a log or a name', () => {
    expect(labelHead('Run npm test\ncurl x | sh')).toBe('Run npm test …');
    expect(labelHead('Run npm test')).toBe('Run npm test');
    expect(labelHead(`Run ${'a'.repeat(400)}`)).toHaveLength(RUN_REQUEST_LABEL_MAX);
  });
});

describe('requestOfCall', () => {
  it('keeps a permission as its label alone, never the tool input', () => {
    const request = requestOfCall('Bash', { command: 'rm -rf build' }, FOLDER);
    expect(request).toEqual({ kind: 'permission', label: 'Run rm -rf build', questions: null });
    expect(requestOfCall('Bash', 'not an object', FOLDER)).toEqual({
      kind: 'permission',
      label: 'Run',
      questions: null,
    });
  });

  it('turns AskUserQuestion into a question with its choices, labelled with the first', () => {
    expect(requestOfCall('AskUserQuestion', colorQuestion, FOLDER)).toEqual({
      kind: 'question',
      label: 'Which color should the button be?',
      questions: [
        {
          question: 'Which color should the button be?',
          header: 'Button color',
          options: [
            { label: 'Red', description: 'Red button.' },
            { label: 'Green', description: 'Green button.' },
          ],
          multiSelect: false,
        },
      ],
    });
  });

  it('cuts long questions and extra choices to what the tracker keeps', () => {
    const options = Array.from({ length: RUN_QUESTION_OPTIONS_MAX + 2 }, (_, index) => ({
      label: `Option ${index}`,
    }));
    const long = { questions: [{ question: 'Q'.repeat(RUN_QUESTION_MAX + 50), options }] };
    const [question] = requestOfCall('AskUserQuestion', long, FOLDER)?.questions ?? [];
    expect(question?.question).toHaveLength(RUN_QUESTION_MAX);
    expect(question?.header).toBe('');
    expect(question?.options).toHaveLength(RUN_QUESTION_OPTIONS_MAX);
    expect(question?.options[0]).toEqual({ label: 'Option 0', description: '' });
    expect(question?.multiSelect).toBe(false);
  });

  it('gives nothing for a question with nothing to show', () => {
    expect(requestOfCall('AskUserQuestion', {}, FOLDER)).toBeNull();
    expect(requestOfCall('AskUserQuestion', { questions: [{ header: 'No text' }] }, FOLDER)).toBe(
      null,
    );
    expect(requestOfCall('AskUserQuestion', null, FOLDER)).toBeNull();
  });
});

describe('answerProblem', () => {
  const permission = { kind: 'permission' as const, questions: null };
  const question = requestOfCall('AskUserQuestion', colorQuestion, FOLDER)!;

  it('takes allow or deny alone for a permission', () => {
    expect(answerProblem(permission, { decision: 'allow' })).toBeUndefined();
    expect(answerProblem(permission, { decision: 'deny' })).toBeUndefined();
    expect(answerProblem(permission, { decision: 'allow', answers: ['Yes'] })).toBe(
      'Answer a permission with allow or deny alone.',
    );
  });

  it('takes one answer per question, or a decline with none', () => {
    expect(answerProblem(question, { decision: 'allow', answers: ['Green'] })).toBeUndefined();
    expect(answerProblem(question, { decision: 'deny' })).toBeUndefined();
    expect(answerProblem(question, { decision: 'allow' })).toBe(
      'Send one answer for each of the 1 questions.',
    );
    expect(answerProblem(question, { decision: 'allow', answers: ['Red', 'Green'] })).toBe(
      'Send one answer for each of the 1 questions.',
    );
    expect(answerProblem(question, { decision: 'deny', answers: ['Red'] })).toBe(
      'Send no answers when you decline a question.',
    );
  });
});

describe('the deadline', () => {
  it('ends a request a fixed time after it was made', () => {
    expect(requestExpiresAt(1000)).toBe(1000 + RUN_REQUEST_DEADLINE_MS);
    expect(RUN_REQUEST_DEADLINE_MS).toBe(30 * 60_000);
    expect(requestIsOverdue(5000, 4999)).toBe(false);
    expect(requestIsOverdue(5000, 5000)).toBe(true);
  });

  it('waits at most one wait, and never past the deadline', () => {
    expect(nextWaitMs(100_000, 0)).toBe(RUN_REQUEST_WAIT_MS);
    expect(nextWaitMs(100_000, 90_000)).toBe(10_000);
    expect(nextWaitMs(100_000, 120_000)).toBe(0);
  });
});

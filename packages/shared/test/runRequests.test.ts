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
import { labelHead, permissionLabel } from '../src/logic/runRequests/permissionLabel';
import { requestOfCall } from '../src/logic/runRequests/requestOfCall';

const FOLDER = '/Users/dara/code/app';

const labelOf = (name: string, input: Record<string, unknown>) =>
  permissionLabel(name, input, FOLDER).label;

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
    expect(labelOf('Edit', { file_path: `${FOLDER}/src/a.ts` })).toBe('Edit src/a.ts\n- \n+ ');
    expect(labelOf('Write', { file_path: '/etc/hosts', content: 'x' })).toBe(
      'Write /etc/hosts\n+ x',
    );
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
    const heredoc = "cat > a.ts <<'EOF'\nconst name = 'app';\nEOF";
    expect(labelOf('Bash', { command: heredoc })).toBe(`Run ${heredoc}`);
  });

  it('shows an address with its query and masks secrets in a command', () => {
    expect(labelOf('WebFetch', { url: 'https://x.dev/a?page=2#top' })).toBe(
      'Fetch https://x.dev/a?page=2#top',
    );
    expect(labelOf('WebFetch', { url: 'https://x.dev/a?token=abc123def456' })).not.toContain(
      'abc123def456',
    );
    expect(labelOf('Bash', { command: 'curl -H "Authorization: Bearer abc123" x.dev' })).toBe(
      'Run curl -H "Authorization: Bearer ***" x.dev',
    );
  });

  it("shows an MCP call's arguments as one key: value line each, under its name", () => {
    expect(
      labelOf('mcp__github__merge_pull_request', {
        owner: 'octo',
        repo: 'app',
        pull_number: 42,
        merge_method: 'squash',
        commit_title: 'Fix the crash when rotating',
      }),
    ).toBe(
      [
        'Use github: merge_pull_request',
        'owner: octo',
        'repo: app',
        'pull_number: 42',
        'merge_method: squash',
        'commit_title: Fix the crash when rotating',
      ].join('\n'),
    );
    expect(labelOf('mcp__github__list_repos', {})).toBe('Use github: list_repos');
    expect(labelOf('mcp__a\nb__c', { x: 1 })).toBe('Use a b: c\nx: 1');
  });

  it('shows nested values and strings that would read as something else as compact JSON', () => {
    expect(
      labelOf('mcp__github__create_issue', {
        labels: ['bug', 'ui'],
        options: { draft: true, reviewers: null },
        number: '42',
        flag: 'true',
        empty: '',
        padded: ' x ',
        body: 'Steps:\nrepo: other',
        quoted: '"x"',
        half: 'a \uD83D',
        'two words': 1,
        'a: b': 2,
      }),
    ).toBe(
      [
        'Use github: create_issue',
        'labels: ["bug","ui"]',
        'options: {"draft":true,"reviewers":null}',
        'number: "42"',
        'flag: "true"',
        'empty: ""',
        'padded: " x "',
        'body: "Steps:\\nrepo: other"',
        'quoted: "\\"x\\""',
        'half: "a \\ud83d"',
        '"two words": 1',
        '"a: b": 2',
      ].join('\n'),
    );
  });

  it("masks one literal word under a secret's name, and secrets inside a value", () => {
    expect(
      labelOf('mcp__api__call', {
        api_key: 'abc123def456',
        password: 123456,
        token: '12345',
        use_token: true,
        secret: 'two words',
        headers: { Authorization: 'Bearer abc123def456' },
        note: 'use ghp_abcdefghijklmnop1234 here',
      }),
    ).toBe(
      [
        'Use api: call',
        'api_key: ***',
        'password: ***',
        'token: "***"',
        'use_token: true',
        'secret: two words',
        'headers: {"Authorization":"Bearer ***"}',
        'note: use *** here',
      ].join('\n'),
    );
  });

  it("cuts a long MCP call at the label's limit and says so", () => {
    const long = permissionLabel(
      'mcp__github__create_or_update_file',
      { path: 'a.md', content: 'x'.repeat(RUN_PERMISSION_LABEL_MAX) },
      FOLDER,
    );
    expect(long.label).toHaveLength(RUN_PERMISSION_LABEL_MAX);
    expect(
      long.label.startsWith('Use github: create_or_update_file\npath: a.md\ncontent: xxx'),
    ).toBe(true);
    expect(long.label.endsWith('x…')).toBe(true);
    expect(long.cut).toBe(true);
  });

  it('is cut at its own limit, and says when it was', () => {
    const long = permissionLabel(
      'Bash',
      { command: `echo ${'a'.repeat(RUN_PERMISSION_LABEL_MAX)}` },
      FOLDER,
    );
    expect(long.label).toHaveLength(RUN_PERMISSION_LABEL_MAX);
    expect(long.cut).toBe(true);
    const fits = `echo ${'a'.repeat(RUN_PERMISSION_LABEL_MAX - 'Run echo '.length)}`;
    expect(permissionLabel('Bash', { command: fits }, FOLDER)).toEqual({
      label: `Run ${fits}`,
      cut: false,
    });
    expect(permissionLabel('Bash', { command: 'echo wait…' }, FOLDER)).toEqual({
      label: 'Run echo wait…',
      cut: false,
    });
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
    expect(request).toEqual({
      kind: 'permission',
      label: 'Run rm -rf build',
      labelCut: false,
      questions: null,
    });
    expect(requestOfCall('Bash', 'not an object', FOLDER)).toEqual({
      kind: 'permission',
      label: 'Run',
      labelCut: false,
      questions: null,
    });
  });

  it('says a long command was cut, so the phone can say so', () => {
    const command = `echo ${'a'.repeat(RUN_PERMISSION_LABEL_MAX)}`;
    expect(requestOfCall('Bash', { command }, FOLDER)).toMatchObject({ labelCut: true });
  });

  it('turns AskUserQuestion into a question with its choices, labelled with the first', () => {
    expect(requestOfCall('AskUserQuestion', colorQuestion, FOLDER)).toEqual({
      kind: 'question',
      label: 'Which color should the button be?',
      labelCut: false,
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

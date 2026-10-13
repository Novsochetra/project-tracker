// A push shows on the lock screen without unlocking, so it names only what can't hold a secret:
// masking misses passwords such as `mysql -phunter2` or `echo hunter2 | sudo -S` (PT-210 review).
const PROGRAM = /^[\w./-]+$/;
const SUBCOMMAND = /^[a-z][a-z-]*$/;

// Only these tools' second word says what they do; any other one's may be an argument, a password
// included (`echo hunter2`).
const WITH_SUBCOMMANDS: ReadonlySet<string> = new Set([
  'aws',
  'brew',
  'bun',
  'cargo',
  'deno',
  'docker',
  'gcloud',
  'gh',
  'git',
  'go',
  'helm',
  'kubectl',
  'npm',
  'pip',
  'pnpm',
  'railway',
  'terraform',
  'uv',
  'yarn',
]);

function ranProgram(command: string): string | null {
  const [program = '', next = ''] = command.trim().split(/\s+/);
  const name = PROGRAM.test(program) ? program.split('/').pop() : '';
  if (!name) return null;
  return WITH_SUBCOMMANDS.has(name) && SUBCOMMAND.test(next) ? `${name} ${next}` : name;
}

function hostOf(address: string): string | null {
  try {
    return new URL(address).hostname || null;
  } catch {
    return null;
  }
}

const MCP_HEAD = /^Use (\S+: \S+)$/;

const SUBJECTS: Readonly<Record<string, (detail: string) => string | null>> = {
  Run: (command) => ranProgram(command),
  Read: (path) => path,
  Edit: (path) => path,
  Write: (path) => path,
  Fetch: (address) => hostOf(address),
};

export function permissionSubject(label: string): string | null {
  const [first = ''] = label.split('\n');
  const mcp = MCP_HEAD.exec(first);
  if (mcp) return `use ${mcp[1]}`;
  const space = first.indexOf(' ');
  const verb = first.slice(0, space);
  const subject = Object.hasOwn(SUBJECTS, verb) ? SUBJECTS[verb] : undefined;
  const detail = subject && space > 0 ? subject(first.slice(space + 1).trim()) : null;
  return detail ? `${verb.toLowerCase()} ${detail}` : null;
}

import { gitOutput } from './gitOutput';
import { runTool } from '../git/runTool';

// Git's tree with nothing in it, for a repository with no commit yet.
export const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

const SMALL = 4_000;
const GH_CHECK_MS = 10_000;

async function line(cwd: string, args: readonly string[], signal: AbortSignal) {
  const { text, code } = await gitOutput(cwd, args, { maxChars: SMALL, signal });
  const value = text.trim();
  return code === 0 && value ? value : null;
}

export const headTree = async (cwd: string, signal: AbortSignal): Promise<string> =>
  (await line(cwd, ['rev-parse', '--verify', '-q', 'HEAD^{tree}'], signal)) ?? EMPTY_TREE;

export const currentBranch = (cwd: string, signal: AbortSignal) =>
  line(cwd, ['symbolic-ref', '--short', '-q', 'HEAD'], signal);

const GH_DEFAULT = ['repo', 'view', '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name'];
const ORIGIN_HEAD = ['symbolic-ref', '--short', '-q', 'refs/remotes/origin/HEAD'];

async function ghDefault(cwd: string, signal: AbortSignal): Promise<string | null> {
  try {
    const { code, out } = await runTool('gh', GH_DEFAULT, { cwd, signal });
    return code === 0 && out.trim() ? out.trim() : null;
  } catch {
    return null;
  }
}

// One rule for the phone's confirm text and the helper's push: GitHub's own word when gh can ask
// it, else what origin/HEAD says on this computer.
export async function defaultBranch(
  cwd: string,
  signal: AbortSignal,
  ghIsReady: boolean,
): Promise<string | null> {
  const remote = ghIsReady ? await ghDefault(cwd, signal) : null;
  if (remote) return remote;
  return (await line(cwd, ORIGIN_HEAD, signal))?.replace(/^origin\//, '') ?? null;
}

// Signed in, so Open PR can push and open one; gh not installed counts as not set up.
export async function ghReady(cwd: string): Promise<boolean> {
  try {
    const signal = AbortSignal.timeout(GH_CHECK_MS);
    return (await runTool('gh', ['auth', 'status'], { cwd, signal })).code === 0;
  } catch {
    return false;
  }
}

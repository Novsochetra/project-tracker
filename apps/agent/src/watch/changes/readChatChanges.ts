import {
  BRANCH_NAME_MAX,
  prepareDiff,
  type AddChatChangesInput,
  type ChatChangedFile,
} from '@tracker/shared';
import { changedPaths } from './changedPaths';
import { readDiff } from './readDiff';
import { currentBranch, defaultBranch, ghReady, headTree } from './repoState';

export type ChatChangesBody = Omit<AddChatChangesInput, 'runnerId'>;

const NONE = { diff: '', cut: false };

// The tracker keeps a branch name of a sane length; a longer one reads as no branch.
const sane = (branch: string | null) =>
  branch !== null && branch.length <= BRANCH_NAME_MAX * 2 ? branch : null;

// Against the last commit, so the diff is what a commit of these files would hold; a file the
// chat changed back to it drops out.
async function diffOf(
  cwd: string,
  files: readonly ChatChangedFile[],
  to: string,
  signal: AbortSignal,
) {
  if (files.length === 0) return { files: [], ...NONE };
  const from = await headTree(cwd, signal);
  const paths = files.map((file) => file.path);
  const still = new Set((await changedPaths(cwd, { from, to, paths }, signal)).paths);
  const left = files.filter((file) => still.has(file.path));
  if (left.length === 0) return { files: [], ...NONE };
  const { raw, cut } = await readDiff(cwd, { from, to, paths: left.map((f) => f.path) }, signal);
  return { files: left, ...prepareDiff(raw, cut) };
}

export type GhCheck = (cwd: string) => Promise<boolean>;

export async function readChatChanges(
  cwd: string,
  input: { files: readonly ChatChangedFile[]; to: string; cut: boolean },
  signal: AbortSignal,
  ghCheck: GhCheck = ghReady,
): Promise<ChatChangesBody> {
  const { files, diff, cut } = await diffOf(cwd, input.files, input.to, signal);
  return {
    diff,
    cut: cut || input.cut,
    files,
    branch: sane(await currentBranch(cwd, signal)),
    defaultBranch: sane(await defaultBranch(cwd, signal)),
    ghReady: await ghCheck(cwd),
  };
}

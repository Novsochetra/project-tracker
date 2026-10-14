import { z } from 'zod';
import {
  BRANCH_NAME_MAX,
  CHAT_FILES_MAX,
  COMMIT_MESSAGE_MAX,
  ENDED_GIT_ACTION_STATUSES,
  GIT_ERROR_MAX,
  PR_TITLE_MAX,
  PR_URL_MAX,
} from '../domain/chatChanges';
import { DIFF_PATH_MAX, RUN_DIFF_MAX } from '../domain/changes';
import { branchNameProblem } from '../logic/git/branchName';
import { runnerId } from './runs';

const ID_MAX = 100;
const SHA = /^[0-9a-f]{7,64}$/;

const id = z.string().trim().min(1).max(ID_MAX);
// Paths go to git as arguments, never through a shell, after `--`.
const path = z
  .string()
  .min(1)
  .max(DIFF_PATH_MAX)
  .refine((value) => !value.includes('\0'), 'A path has no NUL.');

const branch = z
  .string()
  .trim()
  .max(BRANCH_NAME_MAX)
  .superRefine((value, ctx) => {
    const problem = branchNameProblem(value);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

// The person's own branch can have any name git takes; only one the tracker makes is checked.
const reportedBranch = z
  .string()
  .min(1)
  .max(BRANCH_NAME_MAX * 2)
  .refine((value) => !value.includes('\0'), 'A branch has no NUL.');

const changedFile = z.object({ path, dirtyBefore: z.boolean() });

const changesBody = {
  diff: z.string().max(RUN_DIFF_MAX),
  cut: z.boolean(),
  files: z.array(changedFile).max(CHAT_FILES_MAX),
  branch: reportedBranch.nullable(),
  defaultBranch: reportedBranch.nullable(),
  ghReady: z.boolean(),
};

// Only the helper that took an Edit or Auto question sends its chat's changes, before it ends it.
export const addChatChangesInput = z.object({ runnerId, ...changesBody });
export type AddChatChangesInput = z.input<typeof addChatChangesInput>;

const withoutNul = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !value.includes('\0'), 'No NUL characters.');

// version names the changes the person looked at, so a commit never takes newer ones unseen.
export const chatCommitInput = z.object({
  version: id,
  message: withoutNul(COMMIT_MESSAGE_MAX),
  paths: z.array(path).min(1, 'Pick at least one file.').max(CHAT_FILES_MAX),
  // A new branch to commit on; the current one when left out.
  branch: branch.optional(),
});
export type ChatCommitInput = z.input<typeof chatCommitInput>;

// confirm is the phone's confirm step: the person saw what is pushed where.
export const chatPullRequestInput = z.object({
  version: id,
  title: withoutNul(PR_TITLE_MAX),
  confirm: z.literal(true),
});
export type ChatPullRequestInput = z.input<typeof chatPullRequestInput>;

const result = z.object({
  sha: z.string().regex(SHA).optional(),
  branch: reportedBranch.optional(),
  url: z
    .url({ protocol: /^https$/ })
    .max(PR_URL_MAX)
    .optional(),
});

export const finishGitActionInput = z.object({
  runnerId,
  status: z.enum(ENDED_GIT_ACTION_STATUSES),
  error: z.string().trim().max(GIT_ERROR_MAX).optional(),
  result: result.optional(),
  // What is left to commit after the action.
  changes: z.object(changesBody).optional(),
});
export type FinishGitActionInput = z.input<typeof finishGitActionInput>;

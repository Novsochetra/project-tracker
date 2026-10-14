import { BRANCH_NAME_MAX } from '../../domain/chatChanges';

const ALLOWED = /^[A-Za-z0-9._/-]+$/;
const PROTECTED = new Set(['main', 'master']);

// Git's own ref rules, narrowed to plain characters, and never a name git reads as a flag.
export function branchNameProblem(name: string): string | null {
  if (name.length === 0) return 'Give the branch a name.';
  if (name.length > BRANCH_NAME_MAX)
    return `Keep the branch name to ${BRANCH_NAME_MAX} characters.`;
  if (!ALLOWED.test(name)) return 'Use letters, digits, ".", "_", "-" and "/" in a branch name.';
  const parts = name.split('/');
  const badPart = parts.some((part) => !part || part.startsWith('.') || part.endsWith('.lock'));
  if (
    name.startsWith('-') ||
    name.endsWith('.') ||
    name.includes('..') ||
    badPart ||
    name === 'HEAD'
  ) {
    return "That name isn't a branch name git takes.";
  }
  return null;
}

export const isProtectedBranch = (name: string, defaultBranch: string | null): boolean =>
  PROTECTED.has(name) || name === defaultBranch;

const SLUG_MAX = 40;

export function proposedBranch(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_MAX)
    .replace(/^-+|-+$/g, '');
  return `chat/${slug || 'changes'}`;
}

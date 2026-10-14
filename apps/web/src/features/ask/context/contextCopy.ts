import type { ContextUse } from '@tracker/shared';

export const CONTEXT_FULL_HINT = 'This chat is getting full. Start a new chat for a new task.';

const tokens = (count: number): string =>
  `${count.toLocaleString('en-US')} token${count === 1 ? '' : 's'}`;

export const contextLabel = (percent: number): string => `Context ${percent}%`;

export const contextUsedText = ({ used, window }: ContextUse): string =>
  `${used.toLocaleString('en-US')} of ${tokens(window)} in Claude's context`;

export const chatTokensText = (count: number): string => `This chat used ${tokens(count)} in all`;

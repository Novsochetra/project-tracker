// Its own file, since copy.ts is part of the first load and Do it loads with the chat.
export const DO_IT_LABEL = 'Do it';
export const DO_IT_TEXT = 'Go ahead with this plan.';
export const doItCaption = (helperName: string): string =>
  `Claude will change files on ${helperName}.`;
const AWAY = {
  offline: () => 'is offline',
  elsewhere: (projectKey: string) => `doesn't run ${projectKey} now`,
  removed: () => 'was removed',
} as const;

export const doItAway = (helperName: string, away: keyof typeof AWAY, projectKey: string): string =>
  `Do it needs ${helperName}, which ${AWAY[away](projectKey)}.`;

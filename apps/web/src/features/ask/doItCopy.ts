// Its own file, since copy.ts is part of the first load and Do it loads with the chat.
export const DO_IT_LABEL = 'Do it';
export const DO_IT_TEXT = 'Go ahead with this plan.';
export const doItCaption = (helperName: string): string =>
  `Claude will change files on ${helperName}.`;
export const doItOffline = (helperName: string): string =>
  `Do it needs ${helperName}, which is offline.`;

const counted = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

export const stepsLabel = (count: number): string => counted(count, 'step', 'steps');

export const earlierLabel = (count: number): string =>
  counted(count, 'earlier step', 'earlier steps');

export const HIDE_EARLIER_LABEL = 'Hide earlier steps';

export const notKeptText = (count: number): string =>
  `${counted(count, 'earlier step was', 'earlier steps were')} not kept.`;

export const STEPS_LIST_LABEL = "Claude's steps";
export const REFUSED_SUFFIX = 'Not allowed';
export const STEPS_FAILED_TEXT = "Couldn't load the steps.";

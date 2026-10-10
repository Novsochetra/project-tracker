import type { RunQuestionOption } from '@tracker/shared';

// Named by the choice alone; its description is read after it.
export const choiceNames = (option: RunQuestionOption, id: string) => ({
  'aria-labelledby': `${id}-label`,
  'aria-describedby': option.description ? `${id}-description` : undefined,
});

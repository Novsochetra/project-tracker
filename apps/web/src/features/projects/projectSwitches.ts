import { AUTO_REVIEW_ROUNDS } from '@tracker/shared';
import type { ProjectSwitch } from './projectForm';

export const PROJECT_SWITCH_TEXT: Record<ProjectSwitch, { label: string; hint: string }> = {
  hideName: {
    label: 'Hide name',
    hint: "Shows the project's key instead of its name, and hides its description and folder. This sheet and the prompt for Claude Code still show them.",
  },
  autoReview: {
    label: 'Review automatically',
    hint: `When Claude finishes a ticket, Claude reviews it on the same computer. Changes it asks for go back to Claude, up to ${AUTO_REVIEW_ROUNDS} rounds.`,
  },
};

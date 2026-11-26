import type { ProjectSwitch } from './projectForm';

export const PROJECT_SWITCH_TEXT: Record<ProjectSwitch, { label: string; hint: string }> = {
  hideName: {
    label: 'Hide name',
    hint: "Shows the project's key instead of its name, and hides its description and folder. This sheet still shows them, and agents still get them with each ticket.",
  },
};

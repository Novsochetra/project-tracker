import type { Project } from '@tracker/shared';

const RISE_STAGGER_MS = 24;
const RISE_MAX_STEPS = 12;

export const riseDelay = (index: number): number =>
  Math.min(Math.max(index, 0), RISE_MAX_STEPS) * RISE_STAGGER_MS;

// A description usually says what the project is, so it hides with the name.
export const descriptionText = ({
  description,
  hideName,
}: Pick<Project, 'description' | 'hideName'>) =>
  hideName ? 'Hidden' : description.trim() || 'No description';

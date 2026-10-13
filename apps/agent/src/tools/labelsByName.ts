import { findLabelByName, sortLabels, type Label } from '@tracker/shared';
import { ToolError } from '../errors';

// A tracker from before labels sends none, which reads as a project without labels.
export function labelsByName(
  labels: readonly Label[] | undefined,
  names: readonly string[],
): Label[] {
  const known = sortLabels(labels ?? []);
  return names.map((name) => {
    const label = findLabelByName(known, name);
    if (label) return label;
    const valid = known.map((candidate) => `"${candidate.name}"`).join(', ');
    throw new ToolError(
      valid
        ? `There is no label named "${name.trim()}". Valid labels: ${valid}.`
        : `There is no label named "${name.trim()}". This project has no labels yet; a person adds them from the project's ••• menu.`,
    );
  });
}

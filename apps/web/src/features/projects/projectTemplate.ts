import {
  PROJECT_TEMPLATE_NAMES,
  PROJECT_TEMPLATES,
  type ProjectTemplateName,
} from '@tracker/shared';
import type { DropdownOption } from '../../components';
import type { ProjectFormValues } from './projectForm';

export const TEMPLATE_OPTIONS: readonly DropdownOption<ProjectTemplateName>[] =
  PROJECT_TEMPLATE_NAMES.map((name) => ({ value: name, label: PROJECT_TEMPLATES[name].label }));

// A starter only replaces an empty field or the last template's own starter, so instructions
// the person typed or edited stay when they try another template.
export function withTemplate(
  values: ProjectFormValues,
  template: ProjectTemplateName,
): ProjectFormValues {
  const typed = values.instructions.trim();
  const untouched = typed === '' || typed === PROJECT_TEMPLATES[values.template].instructions;
  const instructions = untouched ? PROJECT_TEMPLATES[template].instructions : values.instructions;
  return { ...values, template, instructions };
}

export const templateHint = (template: ProjectTemplateName): string =>
  `Statuses: ${PROJECT_TEMPLATES[template].statuses.map((status) => status.name).join(', ')}.`;

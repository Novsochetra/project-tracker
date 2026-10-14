import {
  DEFAULT_PROJECT_TEMPLATE,
  DEFAULT_MAX_PARALLEL_RUNS,
  MAX_PARALLEL_RUNS_MAX,
  derivePrefix,
  resolvePrefix,
  type CreateProjectInput,
  type Project,
  type ProjectTemplateName,
  type UpdateProjectInput,
} from '@tracker/shared';

export type ProjectFormMode = 'new' | 'edit';

export interface ProjectFormValues {
  name: string;
  description: string;
  repo: string;
  prefix: string;
  instructions: string;
  template: ProjectTemplateName;
  autoReview: boolean;
  maxParallelRuns: string;
}

export const EMPTY_PROJECT_FORM: ProjectFormValues = {
  name: '',
  description: '',
  repo: '',
  prefix: '',
  instructions: '',
  template: DEFAULT_PROJECT_TEMPLATE,
  autoReview: false,
  maxParallelRuns: String(DEFAULT_MAX_PARALLEL_RUNS),
};

export const NAME_REQUIRED = 'Add a name to create the project.';

const REPO_HINT = 'The repository is added to every Claude Code prompt.';

export const formValuesOf = (
  project: Pick<Project, 'name' | 'description' | 'repo' | 'instructions' | 'autoReview'> &
    Partial<Pick<Project, 'maxParallelRuns'>>,
): ProjectFormValues => ({
  ...EMPTY_PROJECT_FORM,
  name: project.name,
  description: project.description,
  repo: project.repo,
  instructions: project.instructions ?? '',
  autoReview: project.autoReview ?? false,
  maxParallelRuns: String(project.maxParallelRuns ?? DEFAULT_MAX_PARALLEL_RUNS),
});

export const hasName = (values: ProjectFormValues): boolean => values.name.trim() !== '';

const TEXT_FIELDS = [
  'name',
  'description',
  'repo',
  'prefix',
  'instructions',
  'template',
  'maxParallelRuns',
] as const;

// Trimmed like Create and Save send them, so a stray space doesn't make the sheet ask.
export const projectFormChanged = (
  values: ProjectFormValues,
  baseline: ProjectFormValues,
): boolean =>
  values.autoReview !== baseline.autoReview ||
  TEXT_FIELDS.some((field) => values[field].trim() !== baseline[field].trim());

export const prefixPlaceholder = (values: ProjectFormValues): string => derivePrefix(values.name);

export function projectHint(mode: ProjectFormMode, values: ProjectFormValues): string {
  if (mode === 'edit')
    return 'The repository is added to every Claude Code prompt for this project.';
  if (!hasName(values) && values.prefix.trim() === '') {
    return `Tickets are numbered with a short prefix, like MOB-1. ${REPO_HINT}`;
  }
  const prefix = resolvePrefix(values.prefix, values.name);
  return `Tickets will be numbered ${prefix}-1, ${prefix}-2 and so on. ${REPO_HINT}`;
}

export const createProjectInput = (values: ProjectFormValues): CreateProjectInput => ({
  name: values.name.trim(),
  key: resolvePrefix(values.prefix, values.name),
  description: values.description.trim(),
  repo: values.repo.trim(),
  instructions: values.instructions.trim(),
  template: values.template,
});

export const updateProjectInput = (values: ProjectFormValues): UpdateProjectInput => ({
  name: values.name.trim(),
  description: values.description.trim(),
  repo: values.repo.trim(),
  instructions: values.instructions.trim(),
  autoReview: values.autoReview,
  maxParallelRuns: parallelRunsOf(values),
});

export const parallelRunsOf = (values: ProjectFormValues): number => {
  const count = Math.round(Number(values.maxParallelRuns));
  if (!Number.isFinite(count)) return DEFAULT_MAX_PARALLEL_RUNS;
  return Math.min(MAX_PARALLEL_RUNS_MAX, Math.max(1, count));
};

export const INSTRUCTIONS_HINT =
  'Claude gets these with every ticket and question in this project.';

export const createdToast = (name: string): string => `“${name}” created`;

export const UPDATED_TOAST = 'Project updated';

import {
  DEFAULT_PROJECT_TEMPLATE,
  DEFAULT_MAX_PARALLEL_RUNS,
  DEFAULT_MAX_SUB_AGENTS,
  MAX_PARALLEL_RUNS_MAX,
  MAX_SUB_AGENTS_MAX,
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
  hideName: boolean;
  maxParallelRuns: string;
  maxSubAgents: string;
}

export const EMPTY_PROJECT_FORM: ProjectFormValues = {
  name: '',
  description: '',
  repo: '',
  prefix: '',
  instructions: '',
  template: DEFAULT_PROJECT_TEMPLATE,
  autoReview: false,
  hideName: false,
  maxParallelRuns: String(DEFAULT_MAX_PARALLEL_RUNS),
  maxSubAgents: String(DEFAULT_MAX_SUB_AGENTS),
};

export const NAME_REQUIRED = 'Add a name to create the project.';

const REPO_HINT = 'The repository is added to every Claude Code prompt.';

export const formValuesOf = (
  project: Pick<
    Project,
    'name' | 'description' | 'repo' | 'instructions' | 'autoReview' | 'hideName'
  > &
    Partial<Pick<Project, 'maxParallelRuns' | 'maxSubAgents'>>,
): ProjectFormValues => ({
  ...EMPTY_PROJECT_FORM,
  name: project.name,
  description: project.description,
  repo: project.repo,
  instructions: project.instructions ?? '',
  autoReview: project.autoReview ?? false,
  hideName: project.hideName ?? false,
  maxParallelRuns: String(project.maxParallelRuns ?? DEFAULT_MAX_PARALLEL_RUNS),
  maxSubAgents: String(project.maxSubAgents ?? DEFAULT_MAX_SUB_AGENTS),
});

export const hasName = (values: ProjectFormValues): boolean => values.name.trim() !== '';

export const PROJECT_SWITCHES = ['autoReview', 'hideName'] as const;
export type ProjectSwitch = (typeof PROJECT_SWITCHES)[number];

const TEXT_FIELDS = [
  'name',
  'description',
  'repo',
  'prefix',
  'instructions',
  'template',
  'maxParallelRuns',
  'maxSubAgents',
] as const;

// Trimmed like Create and Save send them, so a stray space doesn't make the sheet ask.
export const projectFormChanged = (
  values: ProjectFormValues,
  baseline: ProjectFormValues,
): boolean =>
  PROJECT_SWITCHES.some((field) => values[field] !== baseline[field]) ||
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
  hideName: values.hideName,
  maxParallelRuns: parallelRunsOf(values),
  maxSubAgents: subAgentsOf(values),
});

const countIn = (text: string, most: number, fallback: number): number => {
  const count = Math.round(Number(text));
  if (!Number.isFinite(count)) return fallback;
  return Math.min(most, Math.max(1, count));
};

export const parallelRunsOf = (values: ProjectFormValues): number =>
  countIn(values.maxParallelRuns, MAX_PARALLEL_RUNS_MAX, DEFAULT_MAX_PARALLEL_RUNS);

export const subAgentsOf = (values: ProjectFormValues): number =>
  countIn(values.maxSubAgents, MAX_SUB_AGENTS_MAX, DEFAULT_MAX_SUB_AGENTS);

export const SUB_AGENTS_HINT = 'Claude decides when to use sub agents. This is the most at once.';

export const INSTRUCTIONS_HINT =
  'Claude gets these with every ticket and question in this project.';

export const createdToast = (name: string): string => `“${name}” created`;

export const UPDATED_TOAST = 'Project updated';

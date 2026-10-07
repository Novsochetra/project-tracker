export interface PromptDefinition {
  name: string;
  title: string;
  description: string;
  text(project: string | undefined): string;
}

export const normalizeProject = (project: string | undefined): string | undefined =>
  project?.trim().toUpperCase() || undefined;

export const projectArgument = (project: string | undefined): string =>
  project ? `project "${project}"` : 'that project key';

export function findProjectStep(project: string | undefined): string {
  if (project) return `The project key is "${project}".`;
  return (
    'First call list_projects to find the project key. Pick the project whose repository matches the ' +
    'current repository; if that is unclear, ask me which project to use.'
  );
}

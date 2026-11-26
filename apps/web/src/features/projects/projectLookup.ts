export const sameProjectKey = (left: string, right: string): boolean =>
  left.toUpperCase() === right.toUpperCase();

export function findProject<T extends { key: string }>(
  projects: readonly T[] | undefined,
  key: string,
): T | undefined {
  return projects?.find((project) => sameProjectKey(project.key, key));
}

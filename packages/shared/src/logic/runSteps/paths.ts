// A file in the project shows as the person knows it, from the project's folder.
export function shownPath(path: string, folder: string): string {
  const root = folder.endsWith('/') ? folder : `${folder}/`;
  if (path === folder || `${path}/` === root) return '.';
  return path.startsWith(root) ? path.slice(root.length) : path;
}

// A query string can hold a token, so a fetched address shows without one.
export const withoutQuery = (url: string): string => url.split(/[?#]/)[0] ?? '';

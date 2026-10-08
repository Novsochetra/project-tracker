import { parseRoute, routePath } from '../navigation';

export function canonicalPath(pathname: string): string | null {
  const canonical = routePath(parseRoute(pathname));
  return canonical === pathname ? null : canonical;
}

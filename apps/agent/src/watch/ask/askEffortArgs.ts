const EFFORTS: Readonly<Record<string, string>> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh',
  max: 'max',
};

// Only a fixed name becomes an argument; default and anything unknown leave Claude's own effort.
export function askEffortArgs(effort: unknown): string[] {
  const name =
    typeof effort === 'string' && Object.hasOwn(EFFORTS, effort) ? EFFORTS[effort] : undefined;
  return name ? ['--effort', name] : [];
}

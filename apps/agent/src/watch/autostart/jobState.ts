const field = (state: string, name: string): string | undefined =>
  new RegExp(`^\\s*${name} = (.+)$`, 'm').exec(state)?.[1]?.trim();

export function pidFrom(state: string | undefined): number | undefined {
  const pid = state === undefined ? undefined : field(state, 'pid');
  return pid === undefined ? undefined : Number(pid);
}

export const lastExitFrom = (state: string | undefined): string | undefined =>
  state === undefined ? undefined : field(state, 'last exit code');

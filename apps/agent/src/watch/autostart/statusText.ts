export const runningLines = (
  pid: number | undefined,
  lastExit: string | undefined,
  log: string,
): string[] =>
  pid === undefined
    ? [`Running by itself: no (last exit code: ${lastExit ?? 'unknown'}).`, `Log: ${log}`]
    : [`Running by itself: yes (process ${pid}).`];

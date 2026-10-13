import type { ProjectUsage, RunUsage } from '@tracker/shared';

const MICROS = 1_000_000;
// Less than this shows as $0.00, which reads as free.
const CENT_MICROS = 5_000;

const plural = (count: number, word: string): string =>
  `${count.toLocaleString('en-US')} ${word}${count === 1 ? '' : 's'}`;

export function formatDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

// On a subscription the figure is Claude Code's estimate, not a bill, so it says "about".
export function formatCost(micros: number): string {
  if (micros < CENT_MICROS) return 'under $0.01';
  const dollars = (micros / MICROS).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `about $${dollars}`;
}

const usageParts = ({ durationMs, turns, costMicros }: RunUsage): string[] => [
  ...(durationMs === null ? [] : [formatDuration(durationMs)]),
  ...(turns === null ? [] : [plural(turns, 'turn')]),
  ...(costMicros === null ? [] : [formatCost(costMicros)]),
];

// Parts, not a line: the app keeps each one whole when the line wraps ("26" over "turns").
export const runUsageParts = (usage: RunUsage | null): string[] => (usage ? usageParts(usage) : []);

export const projectUsageParts = (usage: ProjectUsage): string[] =>
  usage.runs === 0 ? [] : [plural(usage.runs, 'run'), ...usageParts(usage)];

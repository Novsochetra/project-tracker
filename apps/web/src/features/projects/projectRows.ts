const RISE_STAGGER_MS = 24;
const RISE_MAX_STEPS = 12;

export function progressPercent(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

export const riseDelay = (index: number): number =>
  Math.min(Math.max(index, 0), RISE_MAX_STEPS) * RISE_STAGGER_MS;

export const descriptionText = (description: string): string =>
  description.trim() || 'No description';

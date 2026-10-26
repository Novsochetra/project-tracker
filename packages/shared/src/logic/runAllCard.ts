import { MAX_PARALLEL_RUNS_MAX } from '../domain/run';

export interface RunAllCardSplit {
  before: string;
  // How many sub agents at once the person asked for; null leaves it to Claude.
  limit: number | null;
  after: string;
}

const OPEN = /^(`{3,})run-all[ \t]*$/i;
const CLOSE = /^(`{3,})[ \t]*$/;
const LIMIT = /^limit[ \t]*:[ \t]*(\d{1,3})\b/i;

interface Fence {
  start: number;
  end: number;
}

function lastFence(lines: readonly string[]): Fence | null {
  let found: Fence | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    const ticks = OPEN.exec(lines[i] ?? '')?.[1]?.length;
    if (!ticks) continue;
    const end = lines.findIndex(
      (line, at) => at > i && (CLOSE.exec(line)?.[1]?.length ?? 0) >= ticks,
    );
    if (end === -1) break;
    found = { start: i, end };
    i = end;
  }
  return found;
}

// Out of range is read as the nearest it may be, so "10 at a time" still starts, with 5.
function limitOf(body: readonly string[]): number | null {
  for (const line of body) {
    const value = LIMIT.exec(line.trim())?.[1];
    if (value) return Math.min(MAX_PARALLEL_RUNS_MAX, Math.max(1, Number(value)));
  }
  return null;
}

// The last card wins, as with ticket cards: Claude sends a new one when the person changes it.
export function splitRunAllCard(text: string): RunAllCardSplit | null {
  const lines = text.replace(/\r/g, '').split('\n');
  const fence = lastFence(lines);
  if (!fence) return null;
  return {
    before: lines.slice(0, fence.start).join('\n').trim(),
    limit: limitOf(lines.slice(fence.start + 1, fence.end)),
    after: lines
      .slice(fence.end + 1)
      .join('\n')
      .trim(),
  };
}

// A priority edit may reorder the list; the set is what the person agreed to run.
export function sameTicketKeys(shown: readonly string[], picked: readonly string[]): boolean {
  const seen = new Set(shown);
  return seen.size === picked.length && picked.every((key) => seen.has(key));
}

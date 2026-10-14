import {
  CONTEXT_CRITICAL_PERCENT,
  CONTEXT_FULL_PERCENT,
  type ContextLevel,
  type ContextUse,
} from '../domain/chatContext';
import { isJson, type Json } from './json';

// What a turn's stream-json says so far about Claude's context.
export interface ContextReading {
  used?: number;
  model?: string;
  window?: number;
}

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

const promptTokens = (usage: Json): number =>
  count(usage.input_tokens) +
  count(usage.cache_read_input_tokens) +
  count(usage.cache_creation_input_tokens);

// A sub agent's messages have a parent tool use and a context of their own.
const mainMessageOf = (event: Json): Json | undefined =>
  event.type === 'assistant' && !event.parent_tool_use_id && isJson(event.message)
    ? event.message
    : undefined;

const isCompaction = (event: Json): boolean =>
  event.type === 'system' && event.subtype === 'compact_boundary';

// modelUsage is keyed by the model Claude Code was asked for, which can carry a suffix such as
// "[1m]" that the message's model does not.
const isModel = (key: string, entry: Json, model: string | undefined): boolean =>
  model !== undefined &&
  (key === model || key.startsWith(`${model}[`) || entry.canonicalModel === model);

function windowOf(modelUsage: unknown, model: string | undefined): number | undefined {
  if (!isJson(modelUsage)) return undefined;
  const entries = Object.entries(modelUsage).flatMap(([key, entry]) =>
    isJson(entry) ? [{ key, entry }] : [],
  );
  const mine = entries.filter(({ key, entry }) => isModel(key, entry, model));
  const windows = (mine.length > 0 ? mine : entries).map(({ entry }) => count(entry.contextWindow));
  const widest = Math.max(0, ...windows);
  return widest > 0 ? widest : undefined;
}

function compactedTo(event: Json): number {
  const metadata = isJson(event.compact_metadata) ? event.compact_metadata : {};
  return count(metadata.post_tokens);
}

// The last main message's input is the whole context it was sent; a compaction starts it again.
export function readContext(reading: ContextReading, event: unknown): ContextReading {
  if (!isJson(event)) return reading;
  const message = mainMessageOf(event);
  if (message && isJson(message.usage)) {
    const model = typeof message.model === 'string' ? message.model : reading.model;
    return { ...reading, used: promptTokens(message.usage), ...(model ? { model } : {}) };
  }
  if (isCompaction(event)) return { ...reading, used: compactedTo(event) };
  if (event.type === 'result') {
    const window = windowOf(event.modelUsage, reading.model);
    return window === undefined ? reading : { ...reading, window };
  }
  return reading;
}

export const contextUseOf = ({ used, window }: ContextReading): ContextUse | undefined =>
  used === undefined || window === undefined ? undefined : { used, window };

// Down, so the meter says 80% only once the context is that full.
export const contextPercent = ({ used, window }: ContextUse): number =>
  window > 0 ? Math.min(100, Math.floor((used * 100) / window)) : 0;

export function contextLevel(percent: number): ContextLevel {
  if (percent >= CONTEXT_CRITICAL_PERCENT) return 'critical';
  return percent >= CONTEXT_FULL_PERCENT ? 'full' : 'ok';
}

// What a turn read and wrote: the result's usage covers Claude's main conversation for that turn.
export function turnTokensOf(event: unknown): number | undefined {
  if (!isJson(event) || event.type !== 'result' || !isJson(event.usage)) return undefined;
  return promptTokens(event.usage) + count(event.usage.output_tokens);
}

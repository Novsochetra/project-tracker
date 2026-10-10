import { isJson, type Json } from './json';

const ids = (values: unknown): Json[] => (Array.isArray(values) ? values.filter(isJson) : []);

const rejected = (meta: Json): boolean =>
  isJson(meta.permission_decision) && meta.permission_decision.decision === 'reject';

// The ids of the tool calls an event says were not allowed. A refusal shows in the tool result's
// meta, and sometimes first as a permission_denied event; a call that ran and failed is no refusal.
export function deniedToolIds(event: Json): string[] {
  if (event.type === 'system' && event.subtype === 'permission_denied') {
    return typeof event.tool_use_id === 'string' ? [event.tool_use_id] : [];
  }
  if (event.type !== 'user') return [];
  return ids(event.tool_result_meta)
    .filter(rejected)
    .flatMap((meta) => (typeof meta.id === 'string' ? [meta.id] : []));
}

// Every tool call an event closes, so the reader can forget it.
export function answeredToolIds(event: Json): string[] {
  const content = isJson(event.message) ? event.message.content : undefined;
  if (event.type !== 'user' || !Array.isArray(content)) return [];
  return ids(content).flatMap((block) =>
    block.type === 'tool_result' && typeof block.tool_use_id === 'string'
      ? [block.tool_use_id]
      : [],
  );
}

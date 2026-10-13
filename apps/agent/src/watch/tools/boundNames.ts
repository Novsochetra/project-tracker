import { RUNNER_TOOL_NAME_MAX, RUNNER_TOOLS_MAX } from '@tracker/shared';

// The tracker refuses a check-in past these bounds, and a refused check-in leaves the helper
// offline, so the helper keeps within them itself.
export function boundNames(names: readonly string[]): string[] {
  const kept = names
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && name.length <= RUNNER_TOOL_NAME_MAX);
  return [...new Set(kept)].slice(0, RUNNER_TOOLS_MAX);
}

import type { RunnerTools } from '@tracker/shared';
import type { FoundTools } from './readTools';

// claude mcp list starts every server, which can take most of a minute, so it runs far less
// often than the 20 s check-in, in the background, and check-ins send the last list.
export const TOOLS_REFRESH_MS = 5 * 60_000;

export interface ToolsCacheDeps {
  first: FoundTools;
  read: () => Promise<FoundTools>;
  every?: number | undefined;
  now?: (() => number) | undefined;
}

const keepKnownServers = (last: RunnerTools, next: FoundTools): RunnerTools => ({
  ...next,
  servers: next.servers ?? last.servers,
});

export function createToolsCache({
  first,
  read,
  every = TOOLS_REFRESH_MS,
  now = Date.now,
}: ToolsCacheDeps) {
  let tools = keepKnownServers({ servers: [], commands: [], skills: [] }, first);
  let readAt = now();
  let reading = false;

  // A refresh that fails keeps the last tools: it must never end the helper.
  const refresh = () =>
    read()
      .then((next) => {
        tools = keepKnownServers(tools, next);
      })
      .catch(() => undefined)
      .finally(() => {
        readAt = now();
        reading = false;
      });

  const current = (): RunnerTools => {
    if (!reading && now() - readAt >= every) {
      reading = true;
      void refresh();
    }
    return tools;
  };
  return { current };
}

export type ToolsCache = ReturnType<typeof createToolsCache>;

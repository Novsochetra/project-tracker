export const PROGRESS_MS = 15_000;

interface Progress {
  method: 'notifications/progress';
  params: { progressToken: string | number; progress: number };
}

// Claude Code aborts a call that sends nothing for CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT (30 minutes by
// default, or less if the person set it), and a person may take that long; progress resets it.
export function keepCallAlive(
  token: string | number | undefined,
  send: (notification: Progress) => Promise<void>,
  every = PROGRESS_MS,
): () => void {
  if (token === undefined) return () => undefined;
  let progress = 0;
  const timer = setInterval(() => {
    progress += 1;
    send({ method: 'notifications/progress', params: { progressToken: token, progress } }).catch(
      () => undefined,
    );
  }, every);
  return () => clearInterval(timer);
}

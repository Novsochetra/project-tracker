import { connect } from 'node:net';
import { deny, type PromptDecision } from './promptCall';

export const HELPER_GONE = "The tracker helper didn't answer, so this was not allowed.";

const isDecision = (value: unknown): value is PromptDecision => {
  const behavior = (value as { behavior?: unknown } | null)?.behavior;
  return behavior === 'allow' || behavior === 'deny';
};

// Anything going wrong denies, so Claude never waits on a helper that is gone.
export function askHelper(
  path: string,
  args: unknown,
  signal?: AbortSignal,
): Promise<PromptDecision> {
  return new Promise((resolve) => {
    let text = '';
    const socket = connect(path);
    const done = (decision: PromptDecision) => {
      socket.destroy();
      resolve(decision);
    };
    signal?.addEventListener('abort', () => done(deny(HELPER_GONE)), { once: true });
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(`${JSON.stringify(args)}\n`));
    socket.on('data', (chunk: string) => {
      text += chunk;
    });
    socket.on('error', () => done(deny(HELPER_GONE)));
    socket.on('end', () => {
      try {
        const decision: unknown = JSON.parse(text);
        done(isDecision(decision) ? decision : deny(HELPER_GONE));
      } catch {
        done(deny(HELPER_GONE));
      }
    });
  });
}

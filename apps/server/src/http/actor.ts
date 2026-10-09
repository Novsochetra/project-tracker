import type { Actor } from '@tracker/shared';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from './env';

export const MAX_ACTOR_NAME = 60;

function decodeName(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function parseActor(kind: string | undefined, rawName: string | undefined): Actor {
  const name = decodeName(rawName ?? '')
    .trim()
    .slice(0, MAX_ACTOR_NAME);
  if (kind?.trim().toLowerCase() === 'agent') return { kind: 'agent', name: name || 'Agent' };
  return { kind: 'human', name };
}

export const asAgent = ({ name }: Actor): Actor => ({ kind: 'agent', name: name || 'Agent' });

export const actorMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.set('actor', parseActor(c.req.header('x-actor-kind'), c.req.header('x-actor-name')));
  await next();
});

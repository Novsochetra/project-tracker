export const ACTOR_KINDS = ['human', 'agent'] as const;

export type ActorKind = (typeof ACTOR_KINDS)[number];

export interface Actor {
  kind: ActorKind;
  name: string;
}

export const HUMAN: Actor = { kind: 'human', name: '' };

export const actorLabel = (actor: Actor): string =>
  actor.kind === 'human' && !actor.name ? 'You' : actor.name || 'Agent';

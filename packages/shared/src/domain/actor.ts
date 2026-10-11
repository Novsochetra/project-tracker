export const ACTOR_KINDS = ['human', 'agent'] as const;

export type ActorKind = (typeof ACTOR_KINDS)[number];

export interface Actor {
  kind: ActorKind;
  name: string;
}

export const HUMAN: Actor = { kind: 'human', name: '' };

export const actorLabel = (actor: Actor): string =>
  actor.kind === 'human' && !actor.name ? 'You' : actor.name || 'Agent';

// The web app calls the person "You" and the CLI, which agents read, "User": an agent with either
// name would read as the person.
const PERSON_WORDS = new Set(['you', 'user']);

// Full-width letters and invisible characters would show the same word without matching it.
const comparable = (name: string): string =>
  name
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '')
    .trim()
    .toLowerCase();

export const isPersonWord = (name: string): boolean => PERSON_WORDS.has(comparable(name));

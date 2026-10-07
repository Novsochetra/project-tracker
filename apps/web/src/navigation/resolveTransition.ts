import {
  routePath,
  transitionFor,
  type NavigationKind,
  type Route,
  type Transition,
} from './routes';

export interface NavigationIntent {
  fromKey: string;
  toPath: string;
  animate: boolean;
}

export interface TransitionInput {
  prev: Route;
  prevKey: string;
  next: Route;
  kind: NavigationKind;
  intent: NavigationIntent | null;
  reducedMotion: boolean;
  browserAnimatesPop: boolean;
}

export function resolveTransition(input: TransitionInput): Transition {
  const base = transitionFor(input.prev, input.next, input.kind);
  if (input.reducedMotion) return 'none';
  const { intent } = input;
  const ours = intent !== null && intent.fromKey === input.prevKey;
  if (ours && intent.toPath === routePath(input.next)) return intent.animate ? base : 'none';
  // iOS Safari already animated its own back swipe; a second slide would play twice.
  if (input.kind === 'POP' && input.browserAnimatesPop) return 'none';
  return base;
}

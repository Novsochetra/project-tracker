import { createContext } from 'react';
import { createOpeningStore, type OpeningStore } from './openingStore';
import type { NavigationIntent } from './resolveTransition';
import { routePath, type Route } from './routes';

export type NavigationTarget = Route | string;

export const targetPath = (target: NavigationTarget): string =>
  typeof target === 'string' ? target : routePath(target);

export interface Navigation {
  route: Route;
  canGoBack: boolean;
  push: (target: NavigationTarget) => void;
  replace: (target: NavigationTarget) => void;
  back: () => void;
}

export interface NavigationState extends Navigation {
  intent: NavigationIntent | null;
  finishSwipeBack: () => void;
}

export const NavigationContext = createContext<NavigationState | null>(null);

// A store rather than state, so a push re-renders only the row it opens.
export const OpeningContext = createContext<OpeningStore>(createOpeningStore());

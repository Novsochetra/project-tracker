import { createContext } from 'react';
import type { NavigationIntent } from './resolveTransition';
import type { Route } from './routes';

export type NavigationTarget = Route | string;

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

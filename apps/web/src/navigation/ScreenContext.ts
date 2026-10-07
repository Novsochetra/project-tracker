import { createContext, use, type RefObject } from 'react';
import type { LargeTitleStore } from './largeTitleStore';
import type { Route } from './routes';

export interface Screen {
  route: Route;
  isTop: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export interface ScreenState extends Screen {
  largeTitle: LargeTitleStore;
}

export const ScreenContext = createContext<ScreenState | null>(null);

export function useScreen(): Screen {
  const screen = use(ScreenContext);
  if (!screen) throw new Error('useScreen() only works inside a screen of <StackNavigator>.');
  return screen;
}

export const useOptionalScreen = (): ScreenState | null => use(ScreenContext);

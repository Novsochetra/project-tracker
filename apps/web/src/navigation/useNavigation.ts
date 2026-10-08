import { use, useSyncExternalStore } from 'react';
import {
  NavigationContext,
  OpeningContext,
  targetPath,
  type Navigation,
  type NavigationTarget,
} from './NavigationContext';

export function useNavigation(): Navigation {
  const navigation = use(NavigationContext);
  if (!navigation) {
    throw new Error('useNavigation() needs a <NavigationProvider> or <StackNavigator> above it.');
  }
  return navigation;
}

export const useOptionalNavigation = (): Navigation | null => use(NavigationContext);

// True while a push or replace to the target waits for its screen's code, so the row that was
// tapped can stay pressed until the screen opens.
export function useIsOpening(target: NavigationTarget): boolean {
  const opening = use(OpeningContext);
  const path = targetPath(target);
  return useSyncExternalStore(
    opening.subscribe,
    () => opening.get() === path,
    () => false,
  );
}

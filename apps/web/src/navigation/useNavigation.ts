import { use } from 'react';
import { NavigationContext, type Navigation } from './NavigationContext';

export function useNavigation(): Navigation {
  const navigation = use(NavigationContext);
  if (!navigation) {
    throw new Error('useNavigation() needs a <NavigationProvider> or <StackNavigator> above it.');
  }
  return navigation;
}

export const useOptionalNavigation = (): Navigation | null => use(NavigationContext);

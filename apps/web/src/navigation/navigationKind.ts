import { NavigationType } from 'react-router';
import type { NavigationKind } from './routes';

export function toNavigationKind(type: NavigationType): NavigationKind {
  switch (type) {
    case NavigationType.Push:
      return 'PUSH';
    case NavigationType.Replace:
      return 'REPLACE';
    case NavigationType.Pop:
      return 'POP';
  }
}

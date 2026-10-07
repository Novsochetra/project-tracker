import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router';
import {
  NavigationContext,
  type NavigationState,
  type NavigationTarget,
} from './NavigationContext';
import { toNavigationKind } from './navigationKind';
import type { NavigationIntent } from './resolveTransition';
import { parentRoute, parseRoute, routePath } from './routes';
import { SessionHistory } from './sessionHistory';

const toPath = (target: NavigationTarget): string =>
  typeof target === 'string' ? target : routePath(target);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const { key, pathname } = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const historyRef = useRef<SessionHistory | null>(null);
  const [intent, setIntent] = useState<NavigationIntent | null>(null);

  useLayoutEffect(() => {
    historyRef.current ??= new SessionHistory();
    historyRef.current.record(key, pathname, toNavigationKind(navigationType));
  }, [key, pathname, navigationType]);

  const value = useMemo<NavigationState>(() => {
    const route = parseRoute(pathname);
    const parent = parentRoute(route);
    const go = (target: NavigationTarget, replace: boolean) => {
      const path = toPath(target);
      if (path !== pathname) void navigate(path, { replace });
    };
    const goBack = (animate: boolean) => {
      if (parent === null) return;
      const parentPath = routePath(parent);
      setIntent({ fromKey: key, toPath: parentPath, animate });
      // Deep links have no parent entry behind them, so replace instead of leaving the app.
      if (historyRef.current?.previousPath() === parentPath) void navigate(-1);
      else void navigate(parentPath, { replace: true });
    };
    return {
      route,
      canGoBack: parent !== null,
      intent,
      push: (target) => go(target, false),
      replace: (target) => go(target, true),
      back: () => goBack(true),
      finishSwipeBack: () => goBack(false),
    };
  }, [pathname, key, intent, navigate]);

  return <NavigationContext value={value}>{children}</NavigationContext>;
}

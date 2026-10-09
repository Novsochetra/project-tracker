import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router';
import { reloadsAsked } from '../lib/pageReload';
import {
  NavigationContext,
  OpeningContext,
  targetPath,
  type NavigationState,
  type NavigationTarget,
} from './NavigationContext';
import { toNavigationKind } from './navigationKind';
import { useOpeningStore } from './openingStore';
import { PUSH_WAIT_LIMIT_MS, waitAtMost } from './pushWait';
import type { NavigationIntent } from './resolveTransition';
import { canonicalPath, parentRoute, parseRoute, routePath, type Route } from './routes';
import { SessionHistory } from './sessionHistory';

export interface NavigationProviderProps {
  children: ReactNode;
  // What a push to the route waits for before it touches the history (its screens' code), or null
  // when it can go at once.
  prepare?: (route: Route) => Promise<unknown> | null;
}

const READY = () => null;

export function NavigationProvider({ children, prepare = READY }: NavigationProviderProps) {
  const { key, pathname, search, hash } = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const historyRef = useRef<SessionHistory | null>(null);
  const [intent, setIntent] = useState<NavigationIntent | null>(null);
  const opening = useOpeningStore(key);

  useLayoutEffect(() => {
    historyRef.current ??= new SessionHistory();
    historyRef.current.record(key, pathname, toNavigationKind(navigationType));
  }, [key, pathname, navigationType]);

  // Before any screen's code, so a cold deep link to /p/MOB/ or /p/MOB/01 shows the right URL at
  // once (PT-104); the screen on show is the same either way. Not a layout effect: the router
  // starts listening to the history in its own, which runs after this one on the first render.
  useEffect(() => {
    const canonical = canonicalPath(pathname);
    if (canonical !== null) void navigate({ pathname: canonical, search, hash }, { replace: true });
  }, [pathname, search, hash, navigate]);

  const value = useMemo<NavigationState>(() => {
    const route = parseRoute(pathname);
    const parent = parentRoute(route);
    // The history only ever holds screens that were on show (PT-100): a push waits for its
    // screen's code first, so a second place, the screen on show or a Back while it waits has no
    // entry of it to take over or step past.
    const go = (target: NavigationTarget, replace: boolean) => {
      const path = targetPath(target);
      if (path === opening.get()) return;
      if (path === pathname) {
        opening.clear();
        return;
      }
      const stillOpening = opening.open(path);
      const reloads = reloadsAsked();
      const send = () => {
        if (!stillOpening()) return;
        // A reload asked for while it waited, as its screen's code failed, would fill its entry
        // with the screen on show (PT-108). Only this push: the reload may never come.
        if (reloadsAsked() === reloads) void navigate(path, { replace });
        else opening.clear();
      };
      const waiting = prepare(parseRoute(path));
      if (waiting) void waitAtMost(waiting, PUSH_WAIT_LIMIT_MS).then(send);
      else send();
    };
    const goBack = (animate: boolean) => {
      if (parent === null) return;
      const parentPath = routePath(parent);
      opening.clear();
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
  }, [pathname, key, intent, navigate, opening, prepare]);

  return (
    <NavigationContext value={value}>
      <OpeningContext value={opening}>{children}</OpeningContext>
    </NavigationContext>
  );
}

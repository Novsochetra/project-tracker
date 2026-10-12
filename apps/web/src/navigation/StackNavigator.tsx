import clsx from 'clsx';
import { useMotionValue } from 'motion/react';
import { use, useCallback, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { useIsPhone, usePrefersReducedMotion } from '../lib/media';
import { browserOwnsEdgeSwipe, isTouchDevice } from '../lib/platform';
import { NavigationContext, type NavigationState } from './NavigationContext';
import { toNavigationKind } from './navigationKind';
import { NavigationProvider } from './NavigationProvider';
import { resolveTransition } from './resolveTransition';
import type { Route } from './routes';
import { StackLayerView } from './StackLayerView';
import {
  advanceStackModel,
  createStackModel,
  layerRole,
  settleStackModel,
  type SwipePair,
} from './stackModel';
import type { Platform } from './stackMotion';
import styles from './StackNavigator.module.css';
import './tokens.css';
import { useStackAnimation } from './useStackAnimation';
import { useStatusBarTap } from './useStatusBarTap';
import { useSwipeBack } from './useSwipeBack';

export interface StackNavigatorProps {
  renderScreen: (route: Route) => ReactNode;
  // Given this, a screen opened after the first ones shows it while its code is on its way,
  // instead of waiting above the stack like the first screens. With NavigationProvider's prepare,
  // a push only shows it once it waited out its time limit.
  loading?: ReactNode;
  className?: string;
}

interface BrowserTraits {
  ownsEdgeSwipe: boolean;
  animatesPop: boolean;
}

const readBrowserTraits = (): BrowserTraits => ({
  ownsEdgeSwipe: browserOwnsEdgeSwipe(),
  animatesPop: browserOwnsEdgeSwipe() && isTouchDevice(),
});

function StackView({
  renderScreen,
  loading,
  className,
  navigation,
}: StackNavigatorProps & { navigation: NavigationState }) {
  const { key } = useLocation();
  const kind = toNavigationKind(useNavigationType());
  const platform: Platform = useIsPhone() ? 'phone' : 'desktop';
  const reducedMotion = usePrefersReducedMotion();
  const [browser] = useState(readBrowserTraits);
  const { route } = navigation;
  const [model, setModel] = useState(() => createStackModel(key, route, !reducedMotion));
  const [swipe, setSwipe] = useState<SwipePair | null>(null);
  if (model.locationKey !== key) {
    const transition = resolveTransition({
      prev: model.route,
      prevKey: model.locationKey,
      next: route,
      kind,
      intent: navigation.intent,
      reducedMotion,
      browserAnimatesPop: browser.animatesPop,
    });
    setModel(advanceStackModel(model, key, route, transition));
    setSwipe(null);
  }

  const progress = useMotionValue(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const onSettled = useCallback(
    (id: number) => {
      setModel((current) => (current.id === id ? settleStackModel(current) : current));
    },
    [setModel],
  );
  useStackAnimation({ id: model.id, animation: model.animation, platform, progress, onSettled });
  useStatusBarTap(rootRef);
  const swipeEnabled = platform === 'phone' && !browser.ownsEdgeSwipe;
  useSwipeBack({
    rootRef,
    model,
    swipe,
    setSwipe,
    progress,
    navigation,
    enabled: swipeEnabled,
    reducedMotion,
  });

  const animation = swipe ? 'swipe' : model.animation;
  // A boundary of the layer's own shows its loading state in the layer that slides in (PT-104). A
  // push only mounts a layer once its code is in or its time is up. The browser's Back and Forward
  // can't wait: React renders a navigation made in a popstate event at once, so a screen whose
  // code isn't in showed the boundary above the stack instead, a spinner in place of the whole
  // stack (PT-108).
  const loadsInPlace = loading !== undefined && model.id > 0;
  return (
    <div ref={rootRef} className={clsx(styles.root, className)} data-stack-navigator="">
      {model.layers.map((layer) => (
        <StackLayerView
          key={layer.path}
          layer={layer}
          role={layerRole(model, swipe, layer.path)}
          isTop={!layer.exiting && layer.path === model.path}
          platform={platform}
          animation={animation}
          progress={progress}
          navigated={model.id > 0}
          loadsInPlace={loadsInPlace}
          loading={loading}
          renderScreen={renderScreen}
        />
      ))}
    </div>
  );
}

function StackFromContext(props: StackNavigatorProps) {
  const navigation = use(NavigationContext);
  return navigation ? <StackView {...props} navigation={navigation} /> : null;
}

export function StackNavigator(props: StackNavigatorProps) {
  const navigation = use(NavigationContext);
  if (navigation) return <StackView {...props} navigation={navigation} />;
  return (
    <NavigationProvider>
      <StackFromContext {...props} />
    </NavigationProvider>
  );
}

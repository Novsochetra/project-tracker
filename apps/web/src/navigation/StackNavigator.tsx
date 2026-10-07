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
import { useSwipeBack } from './useSwipeBack';

export interface StackNavigatorProps {
  renderScreen: (route: Route) => ReactNode;
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

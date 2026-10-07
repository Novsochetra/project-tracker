import type { MotionValue } from 'motion/react';
import { useEffect, useRef, type RefObject } from 'react';
import { momentum, type Stop } from '../gestures/animation';
import { releaseProgressVelocity, shouldCompleteBack } from './edgeSwipe';
import type { NavigationState } from './NavigationContext';
import { parentRoute, routePath } from './routes';
import type { StackModel, SwipePair } from './stackModel';
import { useEdgeSwipe } from './useEdgeSwipe';

export interface SwipeBackInput {
  rootRef: RefObject<HTMLElement | null>;
  model: StackModel;
  swipe: SwipePair | null;
  setSwipe: (swipe: SwipePair | null) => void;
  progress: MotionValue<number>;
  navigation: NavigationState;
  enabled: boolean;
  reducedMotion: boolean;
}

const SETTLE = { minMs: 180, maxMs: 380 };

export function useSwipeBack(input: SwipeBackInput): void {
  const { rootRef, model, swipe, setSwipe, progress, navigation, enabled, reducedMotion } = input;
  const parent = parentRoute(model.route);
  const stopRef = useRef<Stop | null>(null);
  useEffect(() => () => stopRef.current?.(), []);

  useEdgeSwipe(rootRef, {
    enabled: enabled && parent !== null && model.animation === 'none' && swipe === null,
    onBegin: () => {
      if (parent) setSwipe({ front: model.path, back: routePath(parent) });
    },
    onProgress: (value) => progress.set(value),
    onRelease: (release) => {
      const complete = shouldCompleteBack(release);
      // The finished swipe already shows the parent, so it navigates without a second animation.
      const done = complete ? navigation.finishSwipeBack : () => setSwipe(null);
      const target = complete ? 0 : 1;
      if (reducedMotion) {
        progress.set(target);
        done();
        return;
      }
      const velocity = releaseProgressVelocity(release.velocity, release.width);
      stopRef.current = momentum(progress, target, { ...SETTLE, velocity }, done);
    },
  });
}

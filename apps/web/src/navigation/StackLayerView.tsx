import type { MotionValue } from 'motion/react';
import { memo, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createLargeTitleStore } from './largeTitleStore';
import type { Route } from './routes';
import { ScreenContext, type ScreenState } from './ScreenContext';
import styles from './StackNavigator.module.css';
import type { StackLayer } from './stackModel';
import type { LayerRole, Platform, StackAnimation } from './stackMotion';
import { useLayerFocus } from './useLayerFocus';
import { useLayerVisual, type LayerRefs } from './useLayerVisual';

export interface StackLayerViewProps {
  layer: StackLayer;
  role: LayerRole;
  isTop: boolean;
  platform: Platform;
  animation: StackAnimation;
  progress: MotionValue<number>;
  navigated: boolean;
  renderScreen: (route: Route) => ReactNode;
}

function StackLayerViewImpl(props: StackLayerViewProps) {
  const { layer, role, isTop, platform, animation, progress, navigated, renderScreen } = props;
  const layerRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [largeTitle] = useState(createLargeTitleStore);
  const refs = useMemo<LayerRefs>(() => ({ layer: layerRef, dim: dimRef, shadow: shadowRef }), []);
  useLayerVisual(refs, { platform, animation, role, progress });
  useLayerFocus(layerRef, scrollRef, isTop, navigated);
  // A screen pushed again while its old copy was still leaving reuses that DOM: start at the top.
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [layer.route]);

  const screen = useMemo<ScreenState>(
    () => ({ route: layer.route, isTop, scrollRef, largeTitle }),
    [layer.route, isTop, largeTitle],
  );
  const content = useMemo(() => renderScreen(layer.route), [renderScreen, layer.route]);

  return (
    <div
      ref={layerRef}
      className={styles.layer}
      inert={!isTop}
      aria-hidden={isTop ? undefined : true}
      data-stack-path={layer.path}
      data-role={role}
    >
      <div ref={scrollRef} className={styles.scroller} tabIndex={-1} data-stack-scroller="">
        <ScreenContext value={screen}>{content}</ScreenContext>
      </div>
      <div ref={dimRef} className={styles.dim} />
      <div ref={shadowRef} className={styles.shadow} />
    </div>
  );
}

export const StackLayerView = memo(StackLayerViewImpl);

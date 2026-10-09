import { createElement, lazy, type ComponentType, type FunctionComponent } from 'react';

export type Preloadable<P> = FunctionComponent<P> & {
  preload: () => Promise<unknown>;
  isLoaded: () => boolean;
};

// Once its code is in, the part renders it directly: React.lazy would still suspend for a tick on
// its first render, which shows a fallback during a tap and loses the tap's focus on iOS.
export function lazyWithPreload<P extends object>(
  load: () => Promise<ComponentType<P>>,
): Preloadable<P> {
  let loaded: ComponentType<P> | null = null;
  let loading: Promise<{ default: ComponentType<P> }> | null = null;
  const preload = () =>
    (loading ??= load().then((component) => {
      loaded = component;
      return { default: component };
    }));
  const Lazy = lazy(preload);
  const Part = (props: P) => createElement(loaded ?? Lazy, props);
  return Object.assign(Part, { preload, isLoaded: () => loaded !== null });
}

import { MotionGlobalConfig } from 'motion/react';
import { PHONE_QUERY } from '../lib/media';

const fakeQueryList = (query: string, matches: boolean): MediaQueryList =>
  ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList;

export function mockPhone(isPhone: boolean): () => void {
  const previous = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => fakeQueryList(query, query === PHONE_QUERY && isPhone),
  });
  return () => {
    if (previous) Object.defineProperty(window, 'matchMedia', previous);
    else Reflect.deleteProperty(window, 'matchMedia');
  };
}

export function skipAnimations(): () => void {
  MotionGlobalConfig.skipAnimations = true;
  return () => {
    MotionGlobalConfig.skipAnimations = false;
  };
}

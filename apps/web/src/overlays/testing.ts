import type { UserEvent } from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { CLICK_SHIELD_MS } from '../lib/clickShield';
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

// An action sheet's rows take no taps right after they appear (ActionSheet), so a test waits like a
// person reading them before tapping one.
export const readActionSheet = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, CLICK_SHIELD_MS));

// A finger's tap. An action sheet takes a mouse's single click at once (useTapShield), so a test of
// what a phone's double tap does taps with this instead of clicking.
export const tap = (user: UserEvent, target: Element): Promise<void> =>
  user.pointer({ keys: '[TouchA]', target });

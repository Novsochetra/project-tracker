import { useSyncExternalStore } from 'react';

// The phone layout is for windows under 768px and for phones, told by the screen: a phone turned
// sideways is wider than 768px (844×390). Not by the window's height, which Android's keyboard
// shrinks (interactive-widget=resizes-content): a tablet held sideways went from 1280×712 to
// 1280×380 while typing and switched layouts under the field. Phones' screens are at most 500px on
// their short side, tablets' at least 600; iOS reports the screen upright, Android as turned, so
// both sides are asked. The desktop query is the exact opposite, the sideways one picks the phones
// held sideways (wider than any phone upright), and the stylesheets repeat all three word for word
// (test/regression/landscape-phone-layout).
export const PHONE_QUERY =
  '(max-width: 767px), (pointer: coarse) and (max-device-width: 500px), (pointer: coarse) and (max-device-height: 500px)';
export const DESKTOP_QUERY =
  '(min-width: 768px) and (pointer: fine), (min-width: 768px) and (pointer: none), (min-width: 768px) and (min-device-width: 501px) and (min-device-height: 501px)';
export const SIDEWAYS_QUERY =
  '(pointer: coarse) and (max-device-width: 500px) and (min-width: 540px), (pointer: coarse) and (max-device-height: 500px) and (min-width: 540px)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
export const NO_HOVER_QUERY = '(hover: none)';

const matches = (query: string): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false;

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => matches(query),
    () => false,
  );
}

export const useIsPhone = (): boolean => useMediaQuery(PHONE_QUERY);

export const usePrefersReducedMotion = (): boolean => useMediaQuery(REDUCED_MOTION_QUERY);

export const isPhoneNow = (): boolean => matches(PHONE_QUERY);

export const prefersReducedMotionNow = (): boolean => matches(REDUCED_MOTION_QUERY);

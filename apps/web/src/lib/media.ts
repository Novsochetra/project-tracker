import { useSyncExternalStore } from 'react';

// The phone layout is for windows under 768px and for phones, told by the screen: a phone turned
// sideways is wider than 768px (844×390). Not by the window's height, which Android's keyboard
// shrinks (interactive-widget=resizes-content): a tablet held sideways went from 1280×712 to
// 1280×380 while typing and switched layouts under the field. A screen under 600px on its short
// side is a phone, Android's own tablet line (phones at a small display size reach 480 and more,
// tablets start at 600, an iPad mini at 744); iOS reports the screen upright, Android as turned,
// so both sides are asked. The desktop query is the exact opposite, each boundary written once as
// `<` and `>=`, so no fractional size falls between them. The sideways query picks the phones
// whose window is at least 600px wide, which none is upright. The stylesheets repeat all three
// word for word (test/regression/landscape-phone-layout).
export const PHONE_QUERY =
  '(width < 768px), (pointer: coarse) and (device-width < 600px), (pointer: coarse) and (device-height < 600px)';
export const DESKTOP_QUERY =
  '(width >= 768px) and (pointer: fine), (width >= 768px) and (pointer: none), (width >= 768px) and (device-width >= 600px) and (device-height >= 600px)';
export const SIDEWAYS_QUERY =
  '(pointer: coarse) and (device-width < 600px) and (width >= 600px), (pointer: coarse) and (device-height < 600px) and (width >= 600px)';
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

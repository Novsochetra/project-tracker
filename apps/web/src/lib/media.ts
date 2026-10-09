import { useSyncExternalStore } from 'react';

// A phone turned sideways is wider than 768px (844×390), so a touch screen under 500px tall gets
// the phone layout too; tablets are at least 744px tall. The desktop query is the exact opposite,
// and the stylesheets repeat both word for word (test/regression/landscape-phone-layout).
export const PHONE_QUERY = '(max-width: 767px), (pointer: coarse) and (max-height: 500px)';
export const DESKTOP_QUERY =
  '(min-width: 768px) and (pointer: fine), (min-width: 768px) and (pointer: none), (min-width: 768px) and (min-height: 501px)';
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

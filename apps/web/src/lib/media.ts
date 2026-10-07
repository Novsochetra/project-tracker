import { useSyncExternalStore } from 'react';

export const PHONE_QUERY = '(max-width: 767px)';
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

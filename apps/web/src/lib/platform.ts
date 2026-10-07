interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const iPadOnMacUA = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || iPadOnMacUA;
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const legacy = (navigator as NavigatorWithStandalone).standalone === true;
  const displayMode =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  return legacy || displayMode;
}

export const browserOwnsEdgeSwipe = (): boolean => isIOS() && !isStandalone();

export const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: none)').matches;

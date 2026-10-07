export type HapticKind = 'selection' | 'light' | 'success' | 'warning';

export const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  selection: 8,
  light: 12,
  success: [12, 60, 16],
  warning: [24, 70, 24],
};

export function haptic(kind: HapticKind): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate(HAPTIC_PATTERNS[kind]);
}

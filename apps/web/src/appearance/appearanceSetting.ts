import { useSyncExternalStore } from 'react';

export type AppearanceChoice = 'system' | 'light' | 'dark';

// index.html reads the same key before the first paint (test/regression/appearance-first-paint).
export const APPEARANCE_STORAGE_KEY = 'tracker.appearance';

const CHOICES: readonly string[] = ['system', 'light', 'dark'];

// Used only when storage refuses a write (private mode, blocked site data, full quota), so the
// choice still lasts for the session.
let unsaved: AppearanceChoice | null = null;
const listeners = new Set<() => void>();

const isChoice = (value: string | null): value is AppearanceChoice =>
  value !== null && CHOICES.includes(value);

function readStored(): AppearanceChoice | null {
  try {
    const value = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);

    return isChoice(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStored(choice: AppearanceChoice): boolean {
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, choice);

    return true;
  } catch {
    return false;
  }
}

// System until the person picks Light or Dark, as on iOS.
export const appearanceChoice = (): AppearanceChoice => unsaved ?? readStored() ?? 'system';

export function setAppearanceChoice(choice: AppearanceChoice): void {
  unsaved = writeStored(choice) ? null : choice;
  listeners.forEach((listener) => listener());
}

export function subscribeAppearanceChoice(listener: () => void): () => void {
  listeners.add(listener);

  return () => void listeners.delete(listener);
}

export const useAppearanceChoice = (): AppearanceChoice =>
  useSyncExternalStore(subscribeAppearanceChoice, appearanceChoice, () => 'system');

import { useSyncExternalStore } from 'react';

export const SOUND_STORAGE_KEY = 'tracker.sounds';

// Used only when storage refuses a write (private mode, blocked site data, full quota), so the
// choice still lasts for the session.
let unsaved: boolean | null = null;
const listeners = new Set<() => void>();

function readStored(): boolean | null {
  try {
    const value = window.localStorage.getItem(SOUND_STORAGE_KEY);

    return value === 'on' ? true : value === 'off' ? false : null;
  } catch {
    return null;
  }
}

function writeStored(on: boolean): boolean {
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, on ? 'on' : 'off');

    return true;
  } catch {
    return false;
  }
}

// On until the person turns them off: the sounds are quiet, and the phone's silent switch mutes
// them as it does the keyboard's clicks.
export const soundsOn = (): boolean => unsaved ?? readStored() ?? true;

export function setSoundsOn(on: boolean): void {
  unsaved = writeStored(on) ? null : on;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => listeners.delete(listener);
};

export const useSoundsOn = (): boolean => useSyncExternalStore(subscribe, soundsOn, () => true);

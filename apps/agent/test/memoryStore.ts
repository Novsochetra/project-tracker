import type { ConfigStore } from '../src/configFile';
import { NO_SAVED_CONFIG, type SavedConfig } from '../src/savedConfig';

export interface MemoryStore extends ConfigStore {
  saved: SavedConfig;
}

export function memoryStore(initial: SavedConfig = NO_SAVED_CONFIG): MemoryStore {
  const store: MemoryStore = {
    path: '/home/dara/.config/project-tracker/config.json',
    saved: initial,
    read: () => store.saved,
    write: (config) => {
      store.saved = config;
    },
  };
  return store;
}

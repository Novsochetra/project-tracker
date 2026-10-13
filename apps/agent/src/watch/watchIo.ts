import type { Env } from '../config';
import type { ConfigStore } from '../configFile';

export interface WatchArgs {
  project?: string | undefined;
  name?: string | undefined;
  permissionMode?: string | undefined;
  maxTurns?: string | undefined;
  keepAwake?: boolean | undefined;
  approvals?: boolean | undefined;
}

export interface WatchIo {
  env: Env;
  store: ConfigStore;
  cwd: string;
  stdout: (text: string) => void;
  write: (text: string) => void;
  untilStopped: () => Promise<void>;
}

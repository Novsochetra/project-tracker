import type { Actor } from '@tracker/shared';
import type { Access } from '../auth/access';

export interface AppEnv {
  Variables: { actor: Actor; access: Access | null };
}

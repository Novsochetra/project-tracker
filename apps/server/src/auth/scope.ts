import { AppError } from '../errors';
import type { Access } from './access';

// Null on a tracker without an owner, where everyone on this computer is the one person.
export type UserScope = string | null;

export function scopeOf(access: Access | null | undefined): UserScope | undefined {
  switch (access?.kind) {
    case 'session':
    case 'token':
      return access.userId;
    case 'open':
      return null;
    case undefined:
      return undefined;
  }
}

export function requireScope(access: Access | null | undefined): UserScope {
  const scope = scopeOf(access);
  if (scope === undefined) throw new AppError('unauthorized', 'Sign in to use this tracker.');
  return scope;
}

export const inScope = (userId: UserScope, scope: UserScope): boolean => userId === scope;

import type { UserRole } from '@tracker/shared';

export interface UserRow {
  id: string;
  // Kept lower-case (normalizeEmail), so sign-in ignores case.
  email: string;
  passwordHash: string;
  createdAt: number;
  updatedAt: number;
  name: string;
  // The owner is the account owner:set made; only the owner invites others.
  role: UserRole;
}

export interface SessionRow {
  id: string;
  userId: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
}

export interface ApiTokenRow {
  id: string;
  userId: string;
  name: string;
  hint: string;
  tokenHash: string;
  createdAt: number;
  lastUsedAt: number | null;
}

// The id is random; the link holds a secret whose SHA-256 is kept, as for tokens.
export interface InviteRow {
  id: string;
  tokenHash: string;
  createdBy: string;
  createdAt: number;
  expiresAt: number;
  usedAt: number | null;
  usedBy: string | null;
}

export interface AuthTables {
  users: UserRow;
  sessions: SessionRow;
  apiTokens: ApiTokenRow;
  invites: InviteRow;
}

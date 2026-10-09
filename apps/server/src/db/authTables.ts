export interface UserRow {
  id: string;
  // Kept lower-case (normalizeEmail), so sign-in ignores case.
  email: string;
  passwordHash: string;
  createdAt: number;
  updatedAt: number;
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

export interface AuthTables {
  users: UserRow;
  sessions: SessionRow;
  apiTokens: ApiTokenRow;
}

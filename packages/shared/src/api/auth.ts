import { z } from 'zod';
import { API_TOKEN_NAME_MAX } from '../domain/apiToken';

export const EMAIL_MAX = 254;
export const PASSWORD_MAX = 1024;

// The answer to a failed sign-in never says which of the two was wrong.
export const LOGIN_FAILED_MESSAGE = 'Email or password is incorrect.';

export const loginInput = z.object({
  email: z.string().trim().min(1, 'Enter your email and password.').max(EMAIL_MAX),
  password: z.string().min(1, 'Enter your email and password.').max(PASSWORD_MAX),
});
export type LoginInput = z.input<typeof loginInput>;

export const createApiTokenInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name the token, like “Claude laptop”.')
    .max(API_TOKEN_NAME_MAX, `Use at most ${API_TOKEN_NAME_MAX} characters for the name.`),
});
export type CreateApiTokenInput = z.input<typeof createApiTokenInput>;

export interface ApiToken {
  id: string;
  name: string;
  // The token's first characters, so the owner can tell tokens apart; never enough to use one.
  hint: string;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface CreatedApiToken {
  token: ApiToken;
  // Shown once: the server keeps only its hash.
  secret: string;
}

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

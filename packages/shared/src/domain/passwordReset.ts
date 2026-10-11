// Like the invite page, the reset page keeps the secret after `#`, which browsers never send.
export const RESET_PATH = '/reset-password';

export const resetPageUrl = (origin: string, secret: string): string =>
  `${origin}${RESET_PATH}#${secret}`;

export const RESET_LINK_FAILED = 'This reset link does not work. Ask the owner for a new one.';

export interface InvitedUser {
  id: string;
  name: string;
  email: string;
  createdAt: number;
  resetExpiresAt: number | null;
}

export interface CreatedResetLink {
  expiresAt: number;
  // Shown once: the server keeps only its hash.
  secret: string;
}

export interface ResetLinkCheck {
  email: string;
  expiresAt: number;
}

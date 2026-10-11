// Here and not beside the schemas, so the web app can read these without loading zod.

export type UserRole = 'owner' | 'user';

export const PASSWORD_MIN = 12;
export const USER_NAME_MAX = 60;

// The page's address keeps the secret after `#`, which browsers never send to a server.
export const INVITE_PATH = '/invite';

export const invitePageUrl = (origin: string, secret: string): string =>
  `${origin}${INVITE_PATH}#${secret}`;

export const INVITE_LINK_FAILED = 'This invite link does not work. Ask for a new one.';

export interface Invite {
  id: string;
  createdAt: number;
  expiresAt: number;
}

export interface CreatedInvite {
  invite: Invite;
  // Shown once: the server keeps only its hash.
  secret: string;
}

import { z } from 'zod';
import { EMAIL_MAX, PASSWORD_MAX } from './auth';

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

const inviteSecret = z.string().trim().min(1, INVITE_LINK_FAILED).max(200, INVITE_LINK_FAILED);

export const checkInviteInput = z.object({ secret: inviteSecret });
export type CheckInviteInput = z.input<typeof checkInviteInput>;

export const acceptInviteInput = z.object({
  secret: inviteSecret,
  name: z
    .string()
    .trim()
    .min(1, 'Enter your name.')
    .max(USER_NAME_MAX, `Use at most ${USER_NAME_MAX} characters for the name.`),
  email: z.string().trim().toLowerCase().pipe(z.email('Use a real email address.').max(EMAIL_MAX)),
  password: z
    .string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters for the password.`)
    .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters for the password.`),
});
export type AcceptInviteInput = z.input<typeof acceptInviteInput>;

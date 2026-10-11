import { z } from 'zod';
import { INVITE_LINK_FAILED, PASSWORD_MIN, USER_NAME_MAX } from '../domain/invite';
import { EMAIL_MAX, PASSWORD_MAX } from './auth';

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

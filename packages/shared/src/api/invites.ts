import { z } from 'zod';
import { INVITE_LINK_FAILED, USER_NAME_MAX } from '../domain/invite';
import { EMAIL_MAX } from './auth';
import { passwordRule } from './passwords';

const inviteSecret = z.string().trim().min(1, INVITE_LINK_FAILED).max(200, INVITE_LINK_FAILED);

export const checkInviteInput = z.object({ secret: inviteSecret });
export type CheckInviteInput = z.input<typeof checkInviteInput>;

// A tab or line break becomes a space; other control characters, a NUL among them, mean nothing in
// a name, and Postgres refuses a NUL.
const plainName = (value: string): string =>
  value.replace(/[\t\n\v\f\r]+/g, ' ').replace(/\p{Cc}/gu, '');

export const acceptInviteInput = z.object({
  secret: inviteSecret,
  name: z
    .string()
    .transform(plainName)
    .pipe(
      z
        .string()
        .trim()
        .min(1, 'Enter your name.')
        .max(USER_NAME_MAX, `Use at most ${USER_NAME_MAX} characters for the name.`),
    ),
  email: z.string().trim().toLowerCase().pipe(z.email('Use a real email address.').max(EMAIL_MAX)),
  password: passwordRule,
});
export type AcceptInviteInput = z.input<typeof acceptInviteInput>;

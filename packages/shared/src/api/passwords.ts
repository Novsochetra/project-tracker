import { z } from 'zod';
import { PASSWORD_MIN } from '../domain/invite';
import { RESET_LINK_FAILED } from '../domain/passwordReset';
import { PASSWORD_MAX } from './auth';

export const passwordRule = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters for the password.`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters for the password.`);

export const changePasswordInput = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.').max(PASSWORD_MAX),
  newPassword: passwordRule,
});
export type ChangePasswordInput = z.input<typeof changePasswordInput>;

const resetSecret = z.string().trim().min(1, RESET_LINK_FAILED).max(200, RESET_LINK_FAILED);

export const checkResetLinkInput = z.object({ secret: resetSecret });
export type CheckResetLinkInput = z.input<typeof checkResetLinkInput>;

export const resetPasswordInput = z.object({ secret: resetSecret, password: passwordRule });
export type ResetPasswordInput = z.input<typeof resetPasswordInput>;

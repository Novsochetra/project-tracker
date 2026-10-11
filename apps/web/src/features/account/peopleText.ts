import { formatFullDate, resetPageUrl, type InvitedUser } from '@tracker/shared';
import type { CopyMessages } from '../connect/useCopyCommand';

export const RESET_COPY: CopyMessages = {
  copied: 'Reset link copied',
  blocked: 'Copying was blocked here. Select the link and copy it yourself.',
};

// The reset page is the web app's, so the link takes the page's own address.
export const resetLinkFor = (secret: string, origin: string): string =>
  resetPageUrl(origin, secret);

// The name is required on an invite, but an account made otherwise may have none.
export const personName = ({ name, email }: Pick<InvitedUser, 'name' | 'email'>): string =>
  name.trim() || email;

export const personDetails = ({ email, resetExpiresAt }: InvitedUser): string =>
  resetExpiresAt === null
    ? email
    : `${email} · Reset link works until ${formatFullDate(resetExpiresAt)}`;

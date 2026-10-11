import { formatFullDate, invitePageUrl, type Invite } from '@tracker/shared';
import type { CopyMessages } from '../connect/useCopyCommand';

export const INVITE_COPY: CopyMessages = {
  copied: 'Invite link copied',
  blocked: 'Copying was blocked here. Select the link and copy it yourself.',
};

// The invite page is the web app's, so the link takes the page's own address.
export const inviteLinkFor = (secret: string, origin: string): string =>
  invitePageUrl(origin, secret);

export const inviteDetails = ({ createdAt, expiresAt }: Invite): string =>
  `Made ${formatFullDate(createdAt)} · Works until ${formatFullDate(expiresAt)}`;

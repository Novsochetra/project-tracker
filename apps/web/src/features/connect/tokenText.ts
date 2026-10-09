import { formatFullDate, formatRelative, type ApiToken } from '@tracker/shared';
import type { CopyMessages } from './useCopyCommand';

export const TOKEN_COPY: CopyMessages = {
  copied: 'Token copied',
  blocked: 'Copying was blocked here. Select the token and copy it yourself.',
};

export const ADDRESS_COPY: CopyMessages = {
  copied: 'Address copied',
  blocked: 'Copying was blocked here. Select the address and copy it yourself.',
};

const lastUse = ({ lastUsedAt }: ApiToken, now: number): string =>
  lastUsedAt === null ? 'Never used' : `Last used ${formatRelative(lastUsedAt, now)}`;

export const tokenDetails = (token: ApiToken, now: number): string =>
  `${token.hint}… · Created ${formatFullDate(token.createdAt)} · ${lastUse(token, now)}`;

export const revokeMessage = (name: string): string =>
  `Revoke “${name}”? Agents using it stop working at once.`;

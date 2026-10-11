// The link keeps the secret as the address's fragment (invitePageUrl).
export const inviteSecretOf = (hash: string): string => hash.replace(/^#/, '').trim();

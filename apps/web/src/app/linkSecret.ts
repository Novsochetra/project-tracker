// A link keeps its secret as the address's fragment (invitePageUrl, resetPageUrl).
export const linkSecretOf = (hash: string): string => hash.replace(/^#/, '').trim();

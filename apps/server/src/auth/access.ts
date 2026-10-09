// Who a request acts for: anyone while the tracker runs locally without an owner, the owner
// through the session cookie, or an agent through one of the owner's API tokens.
export type Access =
  | { kind: 'open' }
  | { kind: 'session'; userId: string; sessionId: string; email: string }
  | { kind: 'token'; userId: string; tokenId: string };

export const OPEN_ACCESS: Access = { kind: 'open' };

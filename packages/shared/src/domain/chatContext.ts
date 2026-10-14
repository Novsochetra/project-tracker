// How full Claude's context is after a chat's latest answer (PT-239). Tokens only, never text.
export interface ContextUse {
  used: number;
  window: number;
}

export interface ChatContext extends ContextUse {
  // What every answer in the chat read and wrote, Claude's main conversation only: Claude Code
  // reports its sub agents' tokens only as session totals.
  tokens: number;
}

export const CONTEXT_FULL_PERCENT = 80;
export const CONTEXT_CRITICAL_PERCENT = 95;

export type ContextLevel = 'ok' | 'full' | 'critical';

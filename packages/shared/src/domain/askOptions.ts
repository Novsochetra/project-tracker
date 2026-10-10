import type { RunKind } from './run';

export const ASK_MODELS = ['default', 'opus', 'sonnet', 'haiku'] as const;
export type AskModel = (typeof ASK_MODELS)[number];

export const ASK_MODES = ['ask', 'plan', 'edit'] as const;
export type AskMode = (typeof ASK_MODES)[number];

export interface AskOptions {
  model: AskModel;
  mode: AskMode;
}

export const DEFAULT_ASK_OPTIONS: AskOptions = { model: 'default', mode: 'ask' };

export const chosenAskOptions = (
  chosen: Partial<AskOptions>,
  saved: AskOptions = DEFAULT_ASK_OPTIONS,
): AskOptions => ({ model: chosen.model ?? saved.model, mode: chosen.mode ?? saved.mode });

// An Edit question changes the folder, so it waits in the ticket lane: two Claudes must never
// change one folder at once.
export const laneOf = (kind: RunKind, askOptions: AskOptions | null): RunKind =>
  kind === 'ask' && askOptions?.mode === 'edit' ? 'ticket' : kind;

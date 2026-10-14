import type { RunKind } from './run';

export const ASK_MODELS = ['default', 'opus', 'sonnet', 'haiku'] as const;
export type AskModel = (typeof ASK_MODELS)[number];

export const ASK_MODES = ['ask', 'plan', 'edit', 'auto'] as const;
export type AskMode = (typeof ASK_MODES)[number];

export const ASK_EFFORTS = ['default', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type AskEffort = (typeof ASK_EFFORTS)[number];

export interface AskOptions {
  model: AskModel;
  mode: AskMode;
  effort: AskEffort;
}

export const DEFAULT_ASK_OPTIONS: AskOptions = { model: 'default', mode: 'ask', effort: 'default' };

// Haiku has no effort setting, so the picker turns off and the helper sends no flag for it.
export const modelTakesEffort = (model: unknown): boolean => model !== 'haiku';

export const chosenAskOptions = (
  chosen: Partial<AskOptions>,
  saved: AskOptions = DEFAULT_ASK_OPTIONS,
): AskOptions => ({
  model: chosen.model ?? saved.model,
  mode: chosen.mode ?? saved.mode,
  effort: chosen.effort ?? saved.effort,
});

// Edit and Auto change the folder. Auto is Edit that never stops to ask the person first.
export const changesFolder = (mode: unknown): boolean => mode === 'edit' || mode === 'auto';

// A question that changes the folder waits in the ticket lane: two Claudes must never change one
// folder at once.
export const laneOf = (kind: RunKind, askOptions: AskOptions | null): RunKind =>
  kind === 'ask' && changesFolder(askOptions?.mode) ? 'ticket' : kind;

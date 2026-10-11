import {
  DEFAULT_ASK_OPTIONS,
  type AskEffort,
  type AskInput,
  type AskMode,
  type AskModel,
  type AskOptions,
  type Chat,
} from '@tracker/shared';
import { EDIT_HINT } from './copy';

export const MODEL_OPTIONS: readonly { value: AskModel; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'opus', label: 'Opus' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'haiku', label: 'Haiku' },
];

export const EFFORT_OPTIONS: readonly { value: AskEffort; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'X-high' },
  { value: 'max', label: 'Max' },
];

export const MODE_OPTIONS: readonly { value: AskMode; label: string }[] = [
  { value: 'ask', label: 'Ask' },
  { value: 'plan', label: 'Plan' },
  { value: 'edit', label: 'Edit' },
];

// A chat from a server without options, or without an effort, starts from the defaults.
export const savedAskOptions = (chat: Pick<Chat, 'options'> | null | undefined): AskOptions => ({
  ...DEFAULT_ASK_OPTIONS,
  ...chat?.options,
});

export const askInputOf = (runnerId: string, text: string, options: AskOptions): AskInput => ({
  runnerId,
  text,
  model: options.model,
  mode: options.mode,
  effort: options.effort,
});

export const askOptionsHint = ({ mode }: AskOptions): string | null =>
  mode === 'edit' ? EDIT_HINT : null;

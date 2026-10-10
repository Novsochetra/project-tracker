import {
  DEFAULT_ASK_OPTIONS,
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

export const MODE_OPTIONS: readonly { value: AskMode; label: string }[] = [
  { value: 'ask', label: 'Ask' },
  { value: 'plan', label: 'Plan' },
  { value: 'edit', label: 'Edit' },
];

// A chat from a server without options starts like a new one.
export const initialAskOptions = (chat: Pick<Chat, 'options'> | null | undefined): AskOptions =>
  chat?.options ?? DEFAULT_ASK_OPTIONS;

export const askInputOf = (runnerId: string, text: string, options: AskOptions): AskInput => ({
  runnerId,
  text,
  model: options.model,
  mode: options.mode,
});

export const askOptionsHint = ({ mode }: AskOptions): string | null =>
  mode === 'edit' ? EDIT_HINT : null;

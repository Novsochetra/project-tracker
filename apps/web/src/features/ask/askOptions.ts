import {
  DEFAULT_ASK_OPTIONS,
  type AskEffort,
  type AskInput,
  type AskMode,
  type AskModel,
  type AskOptions,
  type Chat,
} from '@tracker/shared';
import { ASK_HINT, AUTO_HINT, EDIT_HINT, PLAN_HINT } from './copy';

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
  { value: 'auto', label: 'Auto' },
];

// A chat from a server without options, or without an effort, starts from the defaults.
export const savedAskOptions = (chat: Pick<Chat, 'options'> | null | undefined): AskOptions => ({
  ...DEFAULT_ASK_OPTIONS,
  ...chat?.options,
});

export interface Question {
  text: string;
  attachmentIds: string[];
}

export const askInputOf = (
  runnerId: string,
  { text, attachmentIds }: Question,
  options: AskOptions,
): AskInput => ({
  runnerId,
  text,
  attachmentIds,
  model: options.model,
  mode: options.mode,
  effort: options.effort,
});

// Every mode has a one-line hint, so switching modes never moves the options row (PT-202).
const MODE_HINTS: Record<AskMode, string> = {
  ask: ASK_HINT,
  plan: PLAN_HINT,
  edit: EDIT_HINT,
  auto: AUTO_HINT,
};

export const askOptionsHint = ({ mode }: AskOptions): string => MODE_HINTS[mode];

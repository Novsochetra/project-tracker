import { contextUseOf, readContext, type ContextReading, type ContextUse } from '@tracker/shared';
import type { ClaudeExit } from '../outcome';
import { resultOf, type ClaudeResult } from './claudeResult';
import { createReadTokenCount } from './readTokens';

const KEPT_OUTPUT = 20_000;

export interface ClaudeListeners {
  onOutput: (text: string) => void;
  onEvent: (event: unknown) => void;
}

const withContext = (context: ContextUse | undefined) => (context ? { context } : {});

export function createRunOutput({ onOutput, onEvent }: ClaudeListeners) {
  let output = '';
  const results: ClaudeResult[] = [];
  const tokens = createReadTokenCount();
  let context: ContextReading = {};
  const say = (text: string) => {
    output = (output + text).slice(-KEPT_OUTPUT);
    onOutput(text);
  };
  return {
    say,
    event(event: unknown): ClaudeResult | null {
      onEvent(event);
      tokens.add(event);
      context = readContext(context, event);
      const found = resultOf(event);
      if (!found) return null;
      results.push(found);
      if (found.text) say(`${found.text}\n`);
      return found;
    },
    noteError: (message: string) => {
      output = `${output}\n${message}`;
    },
    exit: (ending: Pick<ClaudeExit, 'code' | 'signal' | 'turnEnded'>): ClaudeExit => ({
      ...ending,
      output,
      results,
      readTokens: tokens.total(),
      ...withContext(contextUseOf(context)),
    }),
  };
}

export type RunOutput = ReturnType<typeof createRunOutput>;

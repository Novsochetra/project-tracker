import type { ClaudeExit } from '../outcome';
import { resultOf, type ClaudeResult } from './claudeResult';
import { createReadTokenCount } from './readTokens';

const KEPT_OUTPUT = 20_000;

export interface ClaudeListeners {
  onOutput: (text: string) => void;
  onEvent: (event: unknown) => void;
}

// What one run, or one turn of a chat's process, showed and answered.
export function createRunOutput({ onOutput, onEvent }: ClaudeListeners) {
  let output = '';
  const results: ClaudeResult[] = [];
  const tokens = createReadTokenCount();
  const say = (text: string) => {
    output = (output + text).slice(-KEPT_OUTPUT);
    onOutput(text);
  };
  return {
    say,
    event(event: unknown): ClaudeResult | null {
      onEvent(event);
      tokens.add(event);
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
    }),
  };
}

export type RunOutput = ReturnType<typeof createRunOutput>;

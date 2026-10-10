import type { Run, Runner } from '@tracker/shared';
import { useState } from 'react';
import { useRunners } from '../../api/hooks/runs';
import { readLastHelper } from '../claude/lastHelper';
import { chatFooter, runHelper, type ChatFooter } from './chatFooter';

export interface AskHelper {
  footer: ChatFooter;
  cardHelper: Runner | null;
  choose: (helperId: string) => void;
}

// The helper the prompt sheet used last on this device answers too, unless the person picks another.
export function useAskHelper(projectKey: string, run: Run | null | undefined): AskHelper {
  const runners = useRunners();
  const [lastUsedId, choose] = useState(readLastHelper);
  const input = { runners: runners.data, projectKey, lastUsedId };
  return { footer: chatFooter({ ...input, run }), cardHelper: runHelper(input), choose };
}

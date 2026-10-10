import type { Run } from '@tracker/shared';
import { useState } from 'react';
import { useRunners } from '../../api/hooks/runs';
import { readLastHelper } from '../claude/lastHelper';
import { chatFooter, type ChatFooter } from './chatFooter';

export interface AskHelper {
  footer: ChatFooter;
  choose: (helperId: string) => void;
}

// The helper the prompt sheet used last on this device answers too, unless the person picks another.
export function useAskHelper(projectKey: string, run: Run | null | undefined): AskHelper {
  const runners = useRunners();
  const [lastUsedId, choose] = useState(readLastHelper);
  return { footer: chatFooter({ runners: runners.data, run, projectKey, lastUsedId }), choose };
}

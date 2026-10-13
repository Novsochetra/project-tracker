import type { Runner, RunRole } from '@tracker/shared';
import { useState } from 'react';
import { useRunners, useStartRun, useTicketRuns } from '../../api/hooks/runs';
import { readLastHelper, rememberHelper } from './lastHelper';
import { runFooter, type RunFooter } from './runs';

export interface RunOffer {
  footer: RunFooter;
  choose: (helperId: string) => void;
  start: (prompt: string, role: RunRole) => void;
  starting: boolean;
  error: Error | null;
}

export interface RunOfferOptions {
  ticketKey: string;
  projectKey: string | undefined;
  open: boolean;
  onStarted: (helper: Runner) => void;
}

export function useRunOffer({ ticketKey, projectKey, open, onStarted }: RunOfferOptions): RunOffer {
  const runners = useRunners({ enabled: open });
  const runs = useTicketRuns(ticketKey);
  const startRun = useStartRun();
  const [lastUsedId, choose] = useState(readLastHelper);
  const footer = runFooter({ runners: runners.data, runs: runs.data, projectKey, lastUsedId });
  const start = (prompt: string, role: RunRole) => {
    if (footer.kind !== 'run') return;
    const { helper } = footer;
    startRun.mutate(
      { ticketKey, input: { runnerId: helper.id, prompt, role } },
      {
        onSuccess: () => {
          rememberHelper(helper.id);
          onStarted(helper);
        },
      },
    );
  };
  return { footer, choose, start, starting: startRun.isPending, error: startRun.error };
}

import type { Run, Runner } from '@tracker/shared';
import { useState } from 'react';
import { useRunners, useStartRun, useTicketRuns } from '../../api/hooks/runs';
import { readLastHelper, rememberHelper } from './lastHelper';
import { helpersFor, pickHelper, runFooter, workingRun, type RunFooter } from './runs';

export interface RunOffer {
  footer: RunFooter;
  helpers: Runner[];
  helper: Runner | undefined;
  choose: (helperId: string) => void;
  working: Run | undefined;
  start: (prompt: string) => void;
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
  const [chosenId, choose] = useState(readLastHelper);
  const helpers = projectKey ? helpersFor(runners.data ?? [], projectKey) : [];
  const helper = pickHelper(helpers, chosenId);
  const working = workingRun(runs.data);
  const start = (prompt: string) => {
    if (!helper) return;
    startRun.mutate(
      { ticketKey, input: { runnerId: helper.id, prompt } },
      {
        onSuccess: () => {
          rememberHelper(helper.id);
          onStarted(helper);
        },
      },
    );
  };
  return {
    footer: runFooter({
      helpersKnown: runners.data !== undefined && projectKey !== undefined,
      helperCount: helpers.length,
      working: working !== undefined,
    }),
    helpers,
    helper,
    choose,
    working,
    start,
    starting: startRun.isPending,
    error: startRun.error,
  };
}

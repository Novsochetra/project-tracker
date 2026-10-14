import type { Project } from '@tracker/shared';
import { Play } from 'lucide-react';
import { errorMessage } from '../../api';
import { useRunActivity } from '../../api/hooks/runActivity';
import { useRunAllTodo, useRunners } from '../../api/hooks/runs';
import { Button, useToast } from '../../components';
import { helpersFor, pickHelper } from '../claude/runs';
import { readLastHelper, rememberHelper } from '../claude/lastHelper';
import { projectRunCounts, runAllToast, runCountsText } from './runAll';
import styles from './RunAllStrip.module.css';

export function RunAllStrip({ project }: { project: Project }) {
  const { show } = useToast();
  const runners = useRunners();
  const activity = useRunActivity();
  const runAll = useRunAllTodo();
  const helper = pickHelper(helpersFor(runners.data ?? [], project.key), readLastHelper());
  const run = () => {
    if (!helper) return;
    runAll.mutate(
      { projectKey: project.key, input: { runnerId: helper.id } },
      {
        onSuccess: (result) => {
          rememberHelper(helper.id);
          show(runAllToast(result));
        },
        onError: (error) => show(errorMessage(error), { kind: 'error' }),
      },
    );
  };
  return (
    <div className={styles.strip}>
      <span className={styles.counts}>
        {runCountsText(projectRunCounts(activity.data, project.key), project.maxParallelRuns)}
      </span>
      <Button
        size="sm"
        icon={Play}
        className={styles.button}
        disabled={!helper || runAll.isPending}
        title={helper ? undefined : 'Start tracker watch on a computer for this project.'}
        onClick={run}
      >
        Run all Todo
      </Button>
    </div>
  );
}

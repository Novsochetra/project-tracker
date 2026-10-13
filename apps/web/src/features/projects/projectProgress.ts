import { openNotReviewed, type ProjectSummary } from '@tracker/shared';

type Counts = Pick<ProjectSummary, 'totalCount' | 'doneCount' | 'openCount'>;

export interface ProjectProgress {
  total: number;
  done: number;
  ready: number;
  open: number;
  percent: number;
  doneShare: number;
  readyShare: number;
}

export interface ProgressPart {
  kind: 'done' | 'ready' | 'open';
  count: number;
}

const share = (count: number, total: number): number => (total > 0 ? (count / total) * 100 : 0);

// Reviewed work counts as progress: only the person's last Done step is left. Floor, so 100%
// means nothing is left at all.
export function projectProgress(counts: Counts, readyCount: number): ProjectProgress {
  const { totalCount: total, doneCount: done, openCount } = counts;
  const open = openNotReviewed(openCount, readyCount);
  const ready = openCount - open;
  return {
    total,
    done,
    ready,
    open,
    percent: Math.floor(share(done + ready, total)),
    doneShare: share(done, total),
    readyShare: share(ready, total),
  };
}

export function progressParts({ done, ready, open }: ProjectProgress): ProgressPart[] {
  const parts: ProgressPart[] = [
    { kind: 'done', count: done },
    { kind: 'ready', count: ready },
    { kind: 'open', count: open },
  ];
  return parts.filter((part) => part.count > 0);
}

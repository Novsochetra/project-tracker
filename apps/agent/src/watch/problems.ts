import type { RunKind } from '@tracker/shared';

export type ProblemSource = RunKind | 'check-in';

// Check-ins and each lane report apart, so one's success can't hide another's failure.
export function createProblemLog(log: (text: string) => void) {
  const problems = new Map<ProblemSource, string>();
  return (source: ProblemSource, problem: string | undefined) => {
    const known = [...problems.values()];
    if (problem) problems.set(source, problem);
    else problems.delete(source);
    if (problem && !known.includes(problem)) log(problem);
    if (known.length > 0 && problems.size === 0) log('In touch with the tracker again.');
  };
}

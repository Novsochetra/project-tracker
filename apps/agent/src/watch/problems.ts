export function createProblemLog(log: (text: string) => void) {
  let current: string | undefined;
  return (problem: string | undefined) => {
    if (problem && problem !== current) log(problem);
    if (!problem && current) log('In touch with the tracker again.');
    current = problem;
  };
}

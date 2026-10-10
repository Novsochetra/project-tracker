// How far the rows got, which is all a move that stops needs to say: files are written again
// under the same keys by the next run either way.
export type MovePhase = 'no-rows' | 'committing' | 'rows-written';

const STOPPED_LINES: Record<MovePhase, string> = {
  'no-rows': 'No rows were written to the target, so running the same command again is safe.',
  committing:
    'It stopped while the rows were being committed, so they may or may not be in the target. ' +
    'Running the same command again is safe: it moves them if they are not there and refuses ' +
    'if they are.',
  'rows-written':
    'The rows were written before it stopped; only the check after them did not finish. ' +
    'Running the same command again would only refuse, since the data is there: open the ' +
    'online tracker to see it.',
};

export const stoppedLine = (phase: MovePhase): string => STOPPED_LINES[phase];

// The error's own message first, then what it means for the rows.
export function stoppedError(error: unknown, phase: MovePhase): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`${message}\n${stoppedLine(phase)}`, { cause: error });
}

import type { LineRef } from '../../domain/changes';

// How a prompt and the agent's tools name a commented line, so Claude finds it in its files.
export const lineLabel = ({ path, side, line }: Pick<LineRef, 'path' | 'side' | 'line'>): string =>
  side === 'new' ? `${path} line ${line}` : `${path} line ${line} before the change`;

export const lineNote = (line: Pick<LineRef, 'path' | 'side' | 'line'>, text: string): string =>
  `On ${lineLabel(line)}: ${text}`;

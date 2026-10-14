import { RUN_STEP_LABEL_MAX } from '../../domain/runStep';
import { cutTo, oneLine } from './cut';
import { maskSecrets } from './secrets';

// Masking runs in stdout's listener, so a line of megabytes is cut first; far past anything shown,
// so the cut never splits a secret in the part a step keeps.
const SAFETY_CUT = 65_536;
export const masked = (text: string): string => maskSecrets(text.slice(0, SAFETY_CUT));

export const stepLabel = (text: string): string => cutTo(oneLine(masked(text)), RUN_STEP_LABEL_MAX);

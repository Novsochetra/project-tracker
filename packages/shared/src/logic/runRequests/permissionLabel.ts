import { RUN_REQUEST_LABEL_MAX } from '../../domain/runRequest';
import { cutTo, oneLine } from '../runSteps/cut';
import { maskSecrets } from '../runSteps/secrets';
import { toolLabel, type ToolInput } from '../runSteps/toolLabel';

// The same words as the call's step, so the phone shows one name for one call, with more room:
// the person decides on it. Never a file's contents, and secrets masked as in steps.
export const permissionLabel = (name: string, input: ToolInput, folder: string): string =>
  cutTo(oneLine(maskSecrets(toolLabel(name, input, folder))), RUN_REQUEST_LABEL_MAX);

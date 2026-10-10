import { RUN_PERMISSION_LABEL_MAX, RUN_REQUEST_LABEL_MAX } from '../../domain/runRequest';
import { cutTo, oneLine } from '../runSteps/cut';
import { maskSecrets } from '../runSteps/secrets';
import { toolLabel, type ToolInput } from '../runSteps/toolLabel';

const field = (input: ToolInput, name: string): string => {
  const value = input[name];
  return typeof value === 'string' ? value.trim() : '';
};

const said = (verb: string, detail: string): string => (detail ? `${verb} ${detail}` : verb);

// A step shows a command's first line and an address without its query (toolLabel), but the
// person allows what runs: every line, a heredoc's body included, and the whole address.
const WHOLE: Readonly<Record<string, (input: ToolInput) => string>> = {
  Bash: (input) => said('Run', field(input, 'command')),
  WebFetch: (input) => said('Fetch', field(input, 'url')),
};

// Masking reads the text several times, so a huge command is cut near the limit first; the room
// past the limit keeps a secret that crosses it whole for its rule.
const MASK_ROOM = 1000;

export interface PermissionLabel {
  label: string;
  // Kept with the request, so the phone can say the command goes on past what it shows and the
  // person never allows what they could not see.
  cut: boolean;
}

// Never a file's contents: a Write or Edit shows only its path, as its step does.
export function permissionLabel(name: string, input: ToolInput, folder: string): PermissionLabel {
  const whole = Object.hasOwn(WHOLE, name) ? WHOLE[name]?.(input) : undefined;
  const label = whole ?? oneLine(toolLabel(name, input, folder));
  const masked = maskSecrets(label.slice(0, RUN_PERMISSION_LABEL_MAX + MASK_ROOM)).trim();
  return {
    label: cutTo(masked, RUN_PERMISSION_LABEL_MAX),
    cut: masked.length > RUN_PERMISSION_LABEL_MAX,
  };
}

export function labelHead(label: string): string {
  const [first = '', ...rest] = label.split('\n');
  return cutTo(oneLine(rest.length > 0 ? `${first} …` : first), RUN_REQUEST_LABEL_MAX);
}

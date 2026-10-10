import { RUN_PERMISSION_LABEL_MAX, RUN_REQUEST_LABEL_MAX } from '../../domain/runRequest';
import { cutTo, oneLine, sliceWhole } from '../runSteps/cut';
import { field, mcpHead, said, toolLabel, type ToolInput } from '../runSteps/toolLabel';
import { maskForPermission } from './permissionMask';
import { argumentLines } from './toolArguments';

// A step shows a command's first line and an address without its query (toolLabel), but the
// person allows what runs: every line, a heredoc's body included, and the whole address.
const WHOLE: Readonly<Record<string, (input: ToolInput) => string>> = {
  Bash: (input) => said('Run', field(input, 'command')),
  WebFetch: (input) => said('Fetch', field(input, 'url')),
};

// A step names only an MCP tool's tracker key, but the person allows the call: which repository,
// which pull request (PT-171). Its name stays one line, since the phone reads the first line as
// the name and every later one as an argument.
const mcpCall = (name: string, input: ToolInput): string =>
  [oneLine(mcpHead(name)), ...argumentLines(input)].join('\n');

function wholeLabel(name: string, input: ToolInput): string | undefined {
  if (name.startsWith('mcp__')) return mcpCall(name, input);
  return Object.hasOwn(WHOLE, name) ? WHOLE[name]?.(input) : undefined;
}

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
  const label = wholeLabel(name, input) ?? oneLine(toolLabel(name, input, folder));
  const room = RUN_PERMISSION_LABEL_MAX + MASK_ROOM;
  const masked = maskForPermission(sliceWhole(label, room)).trim();
  // Masking can shorten a sliced command below the limit, so the slice says it was cut too.
  const sliced = label.length > room;
  if (!sliced && masked.length <= RUN_PERMISSION_LABEL_MAX) return { label: masked, cut: false };
  const shown = sliced ? `${masked}…` : masked;
  return { label: cutTo(shown, RUN_PERMISSION_LABEL_MAX), cut: true };
}

export function labelHead(label: string): string {
  const [first = '', ...rest] = label.split('\n');
  return cutTo(oneLine(rest.length > 0 ? `${first} …` : first), RUN_REQUEST_LABEL_MAX);
}

import { RUN_PERMISSION_LABEL_MAX, RUN_REQUEST_LABEL_MAX } from '../../domain/runRequest';
import { cutTo, oneLine, sliceWhole } from '../runSteps/cut';
import { field, mcpHead, said, toolLabel, type ToolInput } from '../runSteps/toolLabel';
import { changeLines } from './fileChanges';
import { LABEL_ROOM } from './labelRoom';
import { maskForPermission } from './permissionMask';
import { argumentLines } from './toolArguments';

// A step shows a command's first line and an address without its query (toolLabel), but the
// person allows what runs: every line, a heredoc's body included, and the whole address.
const WHOLE: Readonly<Record<string, (input: ToolInput) => string>> = {
  Bash: (input) => said('Run', field(input, 'command')),
  WebFetch: (input) => said('Fetch', field(input, 'url')),
};

// The head stays one line, since the phone reads the first line as the name and every later one
// as what the call does.
const withLines = (head: string, lines: string[]): string => [oneLine(head), ...lines].join('\n');

// A step names only an MCP tool's tracker key and an edit's path, but the person allows the call:
// which repository, which pull request (PT-171), and what an edit writes (PT-171 review: an Edit
// of package.json can add a postinstall script).
function wholeLabel(name: string, input: ToolInput, folder: string): string | undefined {
  if (name.startsWith('mcp__')) return withLines(mcpHead(name), argumentLines(input));
  const change = Object.hasOwn(changeLines, name) ? changeLines[name] : undefined;
  if (change) return withLines(toolLabel(name, input, folder), change(input));
  return Object.hasOwn(WHOLE, name) ? WHOLE[name]?.(input) : undefined;
}

export interface PermissionLabel {
  label: string;
  // Kept with the request, so the phone can say the command goes on past what it shows and the
  // person never allows what they could not see.
  cut: boolean;
}

export function permissionLabel(name: string, input: ToolInput, folder: string): PermissionLabel {
  const label = wholeLabel(name, input, folder) ?? oneLine(toolLabel(name, input, folder));
  const masked = maskForPermission(sliceWhole(label, LABEL_ROOM));
  // Masking can shorten a sliced command below the limit, so the slice says it was cut too.
  const sliced = label.length > LABEL_ROOM;
  if (!sliced && masked.length <= RUN_PERMISSION_LABEL_MAX) return { label: masked, cut: false };
  const shown = sliced ? `${masked}…` : masked;
  return { label: cutTo(shown, RUN_PERMISSION_LABEL_MAX), cut: true };
}

export function labelHead(label: string): string {
  const [first = '', ...rest] = label.split('\n');
  return cutTo(oneLine(rest.length > 0 ? `${first} …` : first), RUN_REQUEST_LABEL_MAX);
}

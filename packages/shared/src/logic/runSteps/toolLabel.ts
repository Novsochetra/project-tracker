import { parseTicketKey } from '../ticketKey';
import { shownPath, withoutQuery } from './paths';

export type ToolInput = Readonly<Record<string, unknown>>;
type Label = (input: ToolInput, folder: string) => string;

const PROJECT_KEY = /^[A-Za-z0-9]{1,20}$/;

const field = (input: ToolInput, name: string): string => {
  const value = input[name];
  return typeof value === 'string' ? value.trim() : '';
};

const said = (verb: string, detail: string): string => (detail ? `${verb} ${detail}` : verb);
const quoted = (text: string): string => (text ? `'${text}'` : '');

const pathIn =
  (verb: string, name = 'file_path'): Label =>
  (input, folder) => {
    const path = field(input, name);
    return said(verb, path && shownPath(path, folder));
  };

const where = (input: ToolInput, folder: string): string => {
  const path = field(input, 'path');
  return path ? ` in ${shownPath(path, folder)}` : '';
};

// Only the first line: the rest of a heredoc is a file's contents.
const ran: Label = (input) => {
  const [first = '', ...rest] = field(input, 'command').split('\n');
  return said('Ran', rest.length > 0 ? `${first.trim()} …` : first);
};

// Only the tracker's keys, never a tool's free text such as a comment or a description.
function mcpLabel(name: string, input: ToolInput): string {
  const [, server = '', ...tool] = name.split('__');
  const ticket = field(input, 'ticket');
  const project = field(input, 'project');
  const key = parseTicketKey(ticket) ? ticket : PROJECT_KEY.test(project) ? project : '';
  return said(`Used ${server}: ${tool.join('__')}`, key);
}

const LABELS: Readonly<Record<string, Label>> = {
  Read: pathIn('Read'),
  Write: pathIn('Wrote'),
  Edit: pathIn('Edited'),
  MultiEdit: pathIn('Edited'),
  NotebookEdit: pathIn('Edited', 'notebook_path'),
  Bash: ran,
  Grep: (input, folder) =>
    `${said('Searched for', quoted(field(input, 'pattern')))}${where(input, folder)}`,
  Glob: (input, folder) =>
    `${said('Found files matching', quoted(field(input, 'pattern')))}${where(input, folder)}`,
  WebFetch: (input) => said('Fetched', withoutQuery(field(input, 'url'))),
  WebSearch: (input) => said('Searched the web for', quoted(field(input, 'query'))),
  TodoWrite: () => 'Updated the to-do list',
  Skill: (input) => said('Used the skill', field(input, 'skill')),
};

export function toolLabel(name: string, input: ToolInput, folder: string): string {
  const label = Object.hasOwn(LABELS, name) ? LABELS[name] : undefined;
  if (label) return label(input, folder);
  return name.startsWith('mcp__') ? mcpLabel(name, input) : `Used ${name}`;
}

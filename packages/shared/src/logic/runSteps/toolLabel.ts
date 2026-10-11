import { parseTicketKey } from '../ticketKey';
import { shownPath, withoutQuery } from './paths';

export type ToolInput = Readonly<Record<string, unknown>>;
type Label = (input: ToolInput, folder: string) => string;

const PROJECT_KEY = /^[A-Za-z0-9]{1,20}$/;

export const field = (input: ToolInput, name: string): string => {
  const value = input[name];
  return typeof value === 'string' ? value.trim() : '';
};

export const said = (verb: string, detail: string): string => (detail ? `${verb} ${detail}` : verb);
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
const run: Label = (input) => {
  const [first = '', ...rest] = field(input, 'command').split('\n');
  return said('Run', rest.length > 0 ? `${first.trim()} …` : first);
};

const ask: Label = (input) => {
  const [first] = Array.isArray(input.questions) ? (input.questions as unknown[]) : [];
  const question = typeof first === 'object' && first !== null ? (first as ToolInput) : {};
  return said('Ask:', field(question, 'question'));
};

export function mcpHead(name: string): string {
  const [, server = '', ...tool] = name.split('__');
  return `Use ${server}: ${tool.join('__')}`;
}

// Only the tracker's keys, never a tool's free text such as a comment or a description.
function mcpLabel(name: string, input: ToolInput): string {
  const ticket = field(input, 'ticket');
  const project = field(input, 'project');
  const key = parseTicketKey(ticket) ? ticket : PROJECT_KEY.test(project) ? project : '';
  return said(mcpHead(name), key);
}

// What Claude asks to do, not what happened: a call can be denied, fail or wait for the person.
const LABELS: Readonly<Record<string, Label>> = {
  Read: pathIn('Read'),
  Write: pathIn('Write'),
  Edit: pathIn('Edit'),
  MultiEdit: pathIn('Edit'),
  NotebookEdit: pathIn('Edit', 'notebook_path'),
  Bash: run,
  Grep: (input, folder) =>
    `${said('Search for', quoted(field(input, 'pattern')))}${where(input, folder)}`,
  Glob: (input, folder) =>
    `${said('Find files matching', quoted(field(input, 'pattern')))}${where(input, folder)}`,
  WebFetch: (input) => said('Fetch', withoutQuery(field(input, 'url'))),
  WebSearch: (input) => said('Search the web for', quoted(field(input, 'query'))),
  TodoWrite: () => 'Update the to-do list',
  Skill: (input) => said('Use the skill', field(input, 'skill')),
  AskUserQuestion: ask,
};

export function toolLabel(name: string, input: ToolInput, folder: string): string {
  const label = Object.hasOwn(LABELS, name) ? LABELS[name] : undefined;
  if (label) return label(input, folder);
  return name.startsWith('mcp__') ? mcpLabel(name, input) : `Use ${name}`;
}

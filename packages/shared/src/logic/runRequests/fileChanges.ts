import { isJson } from '../json';
import { sliceWhole } from '../runSteps/cut';
import { MASK } from '../runSteps/secretRules';
import type { ToolInput } from '../runSteps/toolLabel';
import { LABEL_ROOM, linesWithin } from './labelRoom';

// Not trimmed: a file's spaces are what is written.
const textOf = (input: ToolInput, name: string): string => {
  const value = input[name];
  return typeof value === 'string' ? value : '';
};

const KEY_FILE =
  /^\s*-----BEGIN [A-Z ]{0,40}PRIVATE KEY-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END [A-Z ]{0,40}PRIVATE KEY-----\s*$/;

// A text that is one private key and nothing else never runs, so its base64 lines can go; a key
// inside any other text stays, since a line after its marker may be a path that runs.
const withoutKey = (text: string): string =>
  KEY_FILE.test(text) ? text.replace(/^[A-Za-z0-9+/=]+(?=\r?$)/gm, MASK) : text;

// Every line is marked, so a line of the file can't pose as the start of another change.
const marked = (mark: '-' | '+', text: string): string[] =>
  withoutKey(sliceWhole(text, LABEL_ROOM))
    .split('\n')
    .map((line) => `${mark} ${line}`);

const editLines = (edit: ToolInput): string[] => [
  ...(edit.replace_all === true ? ['replace_all: true'] : []),
  ...marked('-', textOf(edit, 'old_string')),
  ...marked('+', textOf(edit, 'new_string')),
];

export const changeLines: Readonly<Record<string, (input: ToolInput) => string[]>> = {
  Edit: editLines,
  MultiEdit: (input) =>
    linesWithin((Array.isArray(input.edits) ? input.edits : []).filter(isJson), editLines),
  Write: (input) => marked('+', textOf(input, 'content')),
};

import { secretName } from '../runSteps/secretNames';
import type { ToolInput } from '../runSteps/toolLabel';
import { isLiteralWord, maskedWord } from './permissionMask';

const readsAsJson = (text: string): boolean => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

// A string shows as it is only when it reads back as itself: one line, no space at either end, and
// nothing JSON reads as another value (`42`, `true`, `"x"`, `[1]`). Any other value shows as compact
// JSON, so a value can't pose as the next argument or as another type. Half of an emoji shows as
// its JSON escape too, since no font draws it and Postgres can't store it.
const isBare = (text: string): boolean =>
  text !== '' && text === text.trim() && !/[\n\p{Cs}]/u.test(text) && !readsAsJson(text);

// A key that shows as it is has no space, so its value starts at the first `: `.
const keyOf = (key: string): string => (/^[^\s"\p{Cs}]+$/u.test(key) ? key : JSON.stringify(key));

const valueOf = (value: unknown): string =>
  typeof value === 'string' && isBare(value) ? value : (JSON.stringify(value) ?? String(value));

// Masked like `API_KEY=abc123` in a command: one literal word under a secret's name. A flag such
// as `use_token: true` stays, since it is no secret and the person decides on it.
function shownValue(key: string, value: unknown): string {
  const shown = valueOf(value);
  const secret = (typeof value === 'string' || typeof value === 'number') && secretName(key);
  return secret && isLiteralWord(shown) ? maskedWord(shown) : shown;
}

export const argumentLines = (input: ToolInput): string[] =>
  Object.entries(input).map(([key, value]) => `${keyOf(key)}: ${shownValue(key, value)}`);

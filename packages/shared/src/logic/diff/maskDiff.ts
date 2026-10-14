import { MASK } from '../runSteps/secretRules';
import { maskSecrets } from '../runSteps/secrets';
import { FILE_START } from './fileHeader';
import { sidePath } from './gitPath';
import { isSecretPath } from './secretFiles';

const CONTENT_MARKS = new Set(['+', '-', ' ']);
const KEY_BEGIN = /-----BEGIN (?:[A-Z0-9 ]{0,40}PRIVATE KEY|PGP PRIVATE KEY BLOCK)-----/;
const KEY_END = /-----END /;
const PATH_LINES = ['--- ', '+++ ', 'rename from ', 'rename to ', 'copy from ', 'copy to '];

interface FileState {
  secret: boolean;
  inHunk: boolean;
  inKey: boolean;
}

const fresh = (line: string): FileState => ({
  secret: line.split(' ').some((part) => isSecretPath(sidePath(part) ?? '')),
  inHunk: false,
  inKey: false,
});

function readHeader(state: FileState, line: string): void {
  if (line.startsWith('@@')) state.inHunk = true;
  const start = PATH_LINES.find((prefix) => line.startsWith(prefix));
  if (start && isSecretPath(sidePath(line.slice(start.length)) ?? '')) state.secret = true;
}

// A private key's lines come after its BEGIN line, so that is followed from line to line; any
// line of its body, CRLF-ended or not, is masked.
function maskContent(text: string, state: FileState): string {
  if (state.secret) return text.trim() ? MASK : text;
  if (state.inKey && KEY_END.test(text)) state.inKey = false;
  else if (state.inKey) return text.trim() ? MASK : text;
  if (KEY_BEGIN.test(text) && !KEY_END.test(text)) state.inKey = true;
  return maskSecrets(text);
}

// Masks secrets in what the change adds, removes and keeps, a line at a time so no rule reads
// across lines, by the steps' rules (secretRules.ts); a secret file's lines are masked whole.
// Header lines, which name files and commits, stay as they are.
export function maskDiff(text: string): string {
  let state: FileState | null = null;
  return text
    .split('\n')
    .map((line) => {
      if (line.startsWith(FILE_START)) state = fresh(line.slice(FILE_START.length));
      if (!state) return maskSecrets(line);
      if (!state.inHunk) {
        readHeader(state, line);
        return line;
      }
      const mark = line.slice(0, 1);
      return CONTENT_MARKS.has(mark) ? mark + maskContent(line.slice(1), state) : line;
    })
    .join('\n');
}

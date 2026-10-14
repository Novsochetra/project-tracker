import { MASK } from '../runSteps/secretRules';
import { maskSecrets } from '../runSteps/secrets';

const CONTENT_MARKS = new Set(['+', '-', ' ']);
const KEY_BEGIN = /-----BEGIN [A-Z ]{0,40}PRIVATE KEY-----/;
const KEY_END = /-----END /;
const KEY_LINE = /^([ \t]*)[A-Za-z0-9+/]{16,}={0,2}[ \t]*$/;

interface KeyBlock {
  inside: boolean;
}

// One line at a time, so a rule never reads across a file's lines; a private key's base64 lines
// come after its BEGIN line, so that is followed from line to line.
function maskContent(text: string, key: KeyBlock): string {
  if (key.inside && KEY_END.test(text)) key.inside = false;
  else if (key.inside) return text.replace(KEY_LINE, `$1${MASK}`);
  if (KEY_BEGIN.test(text) && !KEY_END.test(text)) key.inside = true;
  return maskSecrets(text);
}

// Masks secrets in what the change adds, removes and keeps, by the steps' rules (secretRules.ts).
// The `diff --git`, `index` and `@@` lines name files and commits and stay as they are.
export function maskDiff(text: string): string {
  const key: KeyBlock = { inside: false };
  return text
    .split('\n')
    .map((line) => {
      const mark = line.slice(0, 1);
      if (line.startsWith('diff --git ')) key.inside = false;
      return !CONTENT_MARKS.has(mark) ? line : mark + maskContent(line.slice(1), key);
    })
    .join('\n');
}

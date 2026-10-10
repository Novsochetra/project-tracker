import { secretName } from './secretNames';

// Names are bounded and every rule starts at a quote, a space or a word's start: open-ended
// `[\w-]*` on both sides of a keyword backtracked for minutes on a 13 KB kebab-case list while the
// helper's stdout listener waited. A value runs to its end, since it ends each pattern and can't
// backtrack, and a cut value would show the rest of a long token. A bare value never starts with
// `-` and stops at a quote, a backtick or a shell symbol, so it never takes the next flag or shell
// word (`--with-token < token.txt`). A quote left open masks to the line's end, unless a space
// follows it: then it closes a string (`grep "API_KEY=" src`) and the rest is no value.
const VALUE = String.raw`(?:"[^"\n]*"|'[^'\n]*'|"[^"\s][^"\n]*|'[^'\s][^'\n]*|[^\s"'\x60<>|;&)-][^\s"'\x60<>|;&)]*)`;
const NAME = String.raw`[\w-]{1,60}`;
// trk_ is this tracker's own API token (API_TOKEN_PREFIX in the server).
const PREFIXED = String.raw`trk_[\w-]{20,}|gh[pousr]_\w+|github_pat_\w+|sk-ant-[\w-]+|sk-[\w-]{20,}|sk_(?:live|test)_\w+|xox[abprs]-[\w-]+|glpat-[\w-]+|AKIA[0-9A-Z]{16}`;

const MASK = '***';

const quoted = (value: string): boolean => /^["']/.test(value);
// `$TOKEN`, `$(gh auth token)`, a backtick or a `{expression}` names a secret without holding it.
const reference = (value: string): boolean => /^["']?[$\x60{]/.test(value);
// A word after `Bearer` or `--token ` in prose ("a Bearer token in the header") stays.
const looksSecret = (value: string): boolean =>
  !reference(value) && (quoted(value) || /\d/.test(value) || value.length >= 12);

type Replace = (match: string, ...groups: string[]) => string;

const KEYED = String.raw`[\w-]{0,40}(?:token|key|secret|pass|pwd|cookie)[\w-]{0,40}`;

export interface SecretRule {
  // The shape it masks, as the tests name it.
  name: string;
  pattern: RegExp;
  replace: Replace;
}

const rule = (name: string, pattern: string, flags: string, replace: Replace): SecretRule => ({
  name,
  pattern: new RegExp(pattern, flags),
  replace,
});

const masked = (head = '') => `${head}${MASK}`;

export const SECRET_RULES: readonly SecretRule[] = [
  rule(
    'quoted header',
    String.raw`(["'](${NAME}):\s{0,4})[^"'\n]+`,
    'g',
    (m, head = '', name = '') => (secretName(name) ? masked(head) : m),
  ),
  rule(
    'authorization scheme',
    String.raw`\b(authorization:["'\\\s]{0,4}(?:basic|bearer|token)(?:\\?\s){1,4})(${VALUE})`,
    'gi',
    (m, head = '', value = '') => (looksSecret(value) ? masked(head) : m),
  ),
  rule(
    'bare header',
    String.raw`((?:^|\s)(${NAME}):)(${VALUE})`,
    'g',
    (m, head = '', name = '', value = '') =>
      secretName(name) && looksSecret(value) ? masked(head) : m,
  ),
  rule('bearer', String.raw`\b(bearer\s{1,4})(${VALUE})`, 'gi', (m, head = '', value = '') =>
    looksSecret(value) ? masked(head) : m,
  ),
  rule(
    'json key',
    String.raw`(\\?["'](${NAME})\\?["']\s{0,4}:\s{0,4}\\?["'])(?:[^"'\\\n]|\\(?!["']))+`,
    'g',
    (m, head = '', name = '') => (secretName(name) ? masked(head) : m),
  ),
  // A numeric user is a uid (docker run -u 1000:1000), not a login.
  rule(
    'user password',
    String.raw`(\s(?:-u|--user)(?:=|\s{1,4})["']?([^\s:"']{1,60}):)(${VALUE})`,
    'g',
    (m, head = '', user = '') => (/^\d+$/.test(user) ? m : masked(head)),
  ),
  rule(
    'address password',
    String.raw`(\/\/[^\s/:@"']{0,100}:)[^\s/@"']+(?=@)`,
    'g',
    (_m, head = '') => masked(head),
  ),
  rule('address token', String.raw`\/\/[^\s/:@"']+(?=@)`, 'g', () => masked('//')),
  // `--token=abc` is a value; after `--token ` it may be prose ("Pass --token to the CLI").
  rule(
    'flag',
    String.raw`(\s--?(${NAME})(?:=|\s{1,4}))(${VALUE})`,
    'g',
    (m, head = '', name = '', value = '') => {
      if (!secretName(name)) return m;
      return (head.endsWith('=') ? !reference(value) : looksSecret(value)) ? masked(head) : m;
    },
  ),
  // Only a name that holds a keyword matches at all, so one that doesn't
  // (--from-literal=password=x) never takes the next one as its value.
  rule(
    'name=value',
    String.raw`(^|[^\w-])(${KEYED})=(${VALUE})`,
    'gi',
    (m, pre = '', name = '', value = '') =>
      secretName(name) && !reference(value) ? `${pre}${name}=${MASK}` : m,
  ),
  rule('known prefix', String.raw`\b(?:${PREFIXED})`, 'g', () => MASK),
  rule('slack webhook', String.raw`(hooks\.slack\.com\/services\/)[^\s"']+`, 'g', (_m, head = '') =>
    masked(head),
  ),
];

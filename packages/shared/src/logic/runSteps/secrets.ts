const MASK = '***';
// A quoted value whole, or a bare one that stops at a quote, a backtick or a shell symbol, so it
// never takes the next shell word (`--with-token < token.txt`).
const VALUE = String.raw`(?:"[^"]*"|'[^']*'|[^\s"'\x60<>|;&)]+)`;
const NAMED = String.raw`[\w-]*(?:token|key|secret|password|passwd|pass)[\w-]*`;
const HEADER = String.raw`authorization|cookie|[\w-]*(?:token|key|secret|password)[\w-]*`;
const PREFIXED = [
  String.raw`gh[pousr]_\w+`,
  String.raw`github_pat_\w+`,
  String.raw`sk-[\w-]+`,
  String.raw`sk_(?:live|test)_\w+`,
  String.raw`xox[abprs]-[\w-]+`,
  String.raw`glpat-[\w-]+`,
  String.raw`AKIA[0-9A-Z]{16}`,
].join('|');

// Best effort, for the shapes a command line or a link usually carries a secret in, so the rest
// stays readable. A short `-p`/`-a` password is left: it can't be told from `mkdir -p`.
const RULES: readonly (readonly [RegExp, string])[] = [
  [new RegExp(String.raw`(["'](?:${HEADER}):\s*)[^"'\n]*`, 'gi'), `$1${MASK}`],
  [new RegExp(String.raw`(\bbearer\s+)${VALUE}`, 'gi'), `$1${MASK}`],
  [new RegExp(String.raw`(\s(?:-u|--user)(?:=|\s+)[^\s:"']+:)${VALUE}`, 'g'), `$1${MASK}`],
  [/(\/\/[^\s/:@"']*:)[^\s/@"']+(?=@)/g, `$1${MASK}`],
  [/\/\/[^\s/:@"']+(?=@)/g, `//${MASK}`],
  [
    new RegExp(
      String.raw`(\s--?[\w-]*(?:token|key|secret|password|passwd)(?:=|\s+))${VALUE}`,
      'gi',
    ),
    `$1${MASK}`,
  ],
  [new RegExp(String.raw`(\b${NAMED}=)${VALUE}`, 'gi'), `$1${MASK}`],
  [new RegExp(String.raw`\b(?:${PREFIXED})`, 'g'), MASK],
  [/(hooks\.slack\.com\/services\/)[^\s"']+/g, `$1${MASK}`],
];

export function maskSecrets(text: string): string {
  return RULES.reduce((masked, [pattern, mask]) => masked.replace(pattern, mask), text);
}

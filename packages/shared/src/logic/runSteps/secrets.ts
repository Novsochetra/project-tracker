const MASK = '***';
// A quoted value whole, spaces and all, or a bare one up to the next space or quote.
const VALUE = String.raw`(?:"[^"]*"|'[^']*'|[^\s"']+)`;
const NAMED = String.raw`[\w-]*(?:token|key|secret|password|passwd)[\w-]*`;

// Only the shapes a command line or an address usually carries a secret in, so the rest of a
// label stays readable; a few harmless values get masked too (`--sort-key=name`).
const PATTERNS: readonly RegExp[] = [
  new RegExp(String.raw`(authorization:\s*(?:(?:bearer|basic|token)\s+)?)${VALUE}`, 'gi'),
  new RegExp(String.raw`(\bbearer\s+)${VALUE}`, 'gi'),
  new RegExp(String.raw`(\s--?${NAMED}(?:=|\s+))${VALUE}`, 'gi'),
  new RegExp(String.raw`(\b${NAMED}=)${VALUE}`, 'gi'),
  /(\/\/[^\s/:@]+:)[^\s/@]+(?=@)/g,
];

export function maskSecrets(text: string): string {
  return PATTERNS.reduce((masked, pattern) => masked.replace(pattern, `$1${MASK}`), text);
}

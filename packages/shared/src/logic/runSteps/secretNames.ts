const ANYWHERE = new Set([
  'secret',
  'password',
  'passwd',
  'passphrase',
  'pwd',
  'token',
  'cookie',
  'authorization',
]);
// A credential's id or path (`credential_id`, `credentialsFile`) names one without holding it.
const LAST = new Set([
  'key',
  'pass',
  'apikey',
  'secretkey',
  'accesskey',
  'privatekey',
  'authkey',
  'credential',
  'credentials',
]);

// By its words, so `MONKEY`, `KEYBOARD_LAYOUT`, `BYPASS_CACHE` and `--key-path` stay readable while
// `GITHUB_TOKEN`, `PGPASSWORD`, `_authToken`, `SECRET_KEY_BASE` and `X-Api-Key` are secret.
export function secretName(name: string): boolean {
  const words = name
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean);
  const last = words.at(-1) ?? '';
  return (
    LAST.has(last) ||
    words.some((word) => ANYWHERE.has(word) || /(?:password|token|secret)$/.test(word))
  );
}

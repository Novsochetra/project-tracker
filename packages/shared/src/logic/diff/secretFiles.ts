// Files that hold secrets as a whole, in shapes no line rule knows (`.netrc`'s `password x`, a
// key's body): every line of their change is masked.
const SECRET_NAMES = [
  /^\.env(?:\..+)?$/,
  /^\.envrc$/,
  /\.env$/,
  /^\.netrc$/,
  /^_netrc$/,
  /^\.pgpass$/,
  /^\.npmrc$/,
  /^\.pypirc$/,
  /^\.git-credentials$/,
  /^credentials(?:\.\w+)?$/,
  /^id_(?:rsa|dsa|ecdsa|ed25519)(?:_sk)?$/,
  /\.(?:pem|key|p12|pfx|jks|keystore|ppk|asc|gpg|kdbx)$/,
  /^secrets?\.(?:json|ya?ml|toml|env)$/,
];

// A template of names with made-up values, read line by line like any other file.
const EXAMPLE = /^\.env\.(?:example|sample|template)$/;

export function isSecretPath(path: string): boolean {
  const name = (path.split('/').at(-1) ?? '').toLowerCase();
  return !EXAMPLE.test(name) && SECRET_NAMES.some((pattern) => pattern.test(name));
}

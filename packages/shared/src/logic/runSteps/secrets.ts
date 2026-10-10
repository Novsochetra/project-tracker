import { SECRET_RULES } from './secretRules';

// Best effort, for the shapes a command line, a header or a link usually carries a secret in, so
// the rest stays readable. A short `-p`/`-a` password is left: it can't be told from `mkdir -p`.
export function maskSecrets(text: string): string {
  return SECRET_RULES.reduce(
    (masked, { pattern, replace }) => masked.replace(pattern, replace),
    text,
  );
}

import type { Plugin } from 'vite';

const DARK_RULE = /:root\[data-appearance='dark'\]\s*\{([^}]*)\}/;
const TOKENS = '/src/design/tokens.css';

// Without JavaScript nothing sets data-appearance (index.html's script, startAppearance), so the
// page follows the system on its own: the dark rule's declarations are repeated under
// prefers-color-scheme for a page that has no data-appearance. Written as the stylesheet is
// built, so the two can't drift apart.
export function withSystemDarkFallback(css: string): string {
  const body = DARK_RULE.exec(css)?.[1];
  if (body === undefined) throw new Error(`${TOKENS} has no :root[data-appearance='dark'] rule.`);

  return `${css}\n@media (prefers-color-scheme: dark) {\n  :root:not([data-appearance]) {${body}}\n}\n`;
}

export const systemDarkFallback = (): Plugin => ({
  name: 'tracker-system-dark-fallback',
  enforce: 'pre',
  transform(code, id) {
    if (!id.split('?')[0]!.endsWith(TOKENS)) return null;

    return withSystemDarkFallback(code);
  },
});

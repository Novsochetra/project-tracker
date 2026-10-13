import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Options } from 'tsup';

type Plugin = NonNullable<Options['esbuildPlugins']>[number];

const ROOT_PACKAGE = fileURLToPath(new URL('../../package.json', import.meta.url));

export function versionOnlyJson(packageText: string): string {
  const { version } = JSON.parse(packageText) as { version?: unknown };
  if (typeof version !== 'string') throw new Error('package.json has no version.');
  return JSON.stringify({ version });
}

// APP_VERSION imports the root package.json whole (Node allows no named JSON imports), and esbuild
// keeps every field of it; bundles should carry the version, not the scripts and dev tools.
export const rootVersionOnly = (packagePath: string = ROOT_PACKAGE): Plugin => ({
  name: 'root-version-only',
  setup(build) {
    build.onLoad({ filter: /package\.json$/ }, (args) =>
      resolve(args.path) === resolve(packagePath)
        ? { contents: versionOnlyJson(readFileSync(args.path, 'utf8')), loader: 'json' }
        : undefined,
    );
  },
});

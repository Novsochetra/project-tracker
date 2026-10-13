import pkg from '../../../../package.json' with { type: 'json' };

// The root package.json is the one version of the whole app: `npm run release` bumps it, and each
// build bakes it in. Its own file, so a bundle that never reads it leaves package.json out.
export const APP_VERSION: string = pkg.version;

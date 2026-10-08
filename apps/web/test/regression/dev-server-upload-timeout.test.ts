import { createServer } from 'node:http';
import { MAX_ATTACHMENT_BYTES } from '@tracker/shared';
import type { Plugin, PluginOption } from 'vite';
import { expect, it } from 'vitest';
import config from '../../vite.config';

const pluginNamed = (options: PluginOption[], name: string): Plugin | undefined =>
  ((options as unknown[]).flat(Infinity) as Plugin[]).find((plugin) => plugin?.name === name);

// `npm run dev` sends uploads through Vite's /api proxy, a Node server that gives a whole request
// five minutes, so a large video sent slowly failed with 408 in development only.
it('lets the largest file arrive through the dev server over a 256 kbit/s uplink', () => {
  const plugin = pluginNamed(config.plugins ?? [], 'tracker-dev-upload-timeout');
  const httpServer = createServer();
  (plugin?.configureServer as (server: { httpServer: unknown }) => void)({ httpServer });
  const bytesPerMs = 256_000 / 8 / 1000;
  expect(httpServer.requestTimeout).toBeGreaterThanOrEqual(MAX_ATTACHMENT_BYTES / bytesPerMs);
});

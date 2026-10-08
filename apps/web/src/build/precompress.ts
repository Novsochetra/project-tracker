import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';
import type { Plugin } from 'vite';

// Images, fonts and videos are compressed already. A type added here goes in ENCODABLE_TYPE in
// apps/server/src/http/static.ts too, so its plain answers say Vary: Accept-Encoding.
const TEXT_FILE = /\.(?:js|mjs|css|html|svg|json|webmanifest|txt|xml)$/;

const brotliAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

const ENCODERS: Record<string, (data: Buffer) => Promise<Buffer>> = {
  br: (data) =>
    brotliAsync(data, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
        [constants.BROTLI_PARAM_SIZE_HINT]: data.length,
      },
    }),
  gz: (data) => gzipAsync(data, { level: constants.Z_BEST_COMPRESSION }),
};

export const isTextFile = (fileName: string): boolean => TEXT_FILE.test(fileName);

async function precompressFile(path: string): Promise<void> {
  const data = await readFile(path);
  await Promise.all(
    Object.entries(ENCODERS).map(async ([extension, encode]) => {
      const encoded = await encode(data);
      // A copy that isn't smaller would only cost bytes; the plain file is sent instead.
      if (encoded.length < data.length) await writeFile(`${path}.${extension}`, encoded);
    }),
  );
}

export async function precompressFolder(folder: string): Promise<void> {
  const entries = await readdir(folder, { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && isTextFile(entry.name));
  await Promise.all(files.map((entry) => precompressFile(join(entry.parentPath, entry.name))));
}

// check:first-load (scripts/check-first-load.ts) measures a build it then deletes; copies would
// only slow it down.
export const SKIP_PRECOMPRESS = 'TRACKER_SKIP_PRECOMPRESS';

// Last of all (enforce and order post): the PWA plugin writes sw.js when the bundle closes, and
// sw.js needs copies too.
export function precompress(): Plugin {
  let outDir = '';
  return {
    name: 'tracker-precompress',
    apply: (_config, { command }) => command === 'build' && !process.env[SKIP_PRECOMPRESS],
    enforce: 'post',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle: {
      order: 'post',
      sequential: true,
      handler: (error) => (error ? undefined : precompressFolder(outDir)),
    },
  };
}

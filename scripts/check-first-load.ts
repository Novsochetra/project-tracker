// Builds the web app into a temporary folder and fails when the JavaScript the first screen
// (Projects) loads grows past its budget or its most files (FIRST_LOAD_LIMITS), or takes in a part
// that should load when opened. The parts are the build's dynamic imports, read from its manifest,
// so a new one is checked too: npx tsx scripts/check-first-load.ts
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';
import {
  FIRST_LOAD_LIMITS,
  firstLoadProblems,
  readFirstLoad,
  type Manifest,
} from '../apps/web/src/build/firstLoad';
import { SKIP_PRECOMPRESS } from '../apps/web/src/build/precompress';

const WEB_ROOT = fileURLToPath(new URL('../apps/web', import.meta.url));

const partName = (key: string) => basename(key).replace(/\.[^.]+$/, '');

process.env[SKIP_PRECOMPRESS] = '1';
const outDir = mkdtempSync(join(tmpdir(), 'tracker-first-load-'));
try {
  // Warnings stay on: Vite's names the module when something imports a lazy part statically.
  await build({
    root: WEB_ROOT,
    logLevel: 'warn',
    build: { outDir, emptyOutDir: true, manifest: true },
  });
  const read = (file: string) => readFileSync(join(outDir, file));
  const manifest = JSON.parse(read('.vite/manifest.json').toString()) as Manifest;
  const load = readFirstLoad(manifest);
  const kB = load.files.reduce((sum, file) => sum + gzipSync(read(file)).length, 0) / 1000;
  process.stdout.write(
    `First-load JS: ${kB.toFixed(1)} kB gzipped in ${load.files.length} files ` +
      `(budget ${FIRST_LOAD_LIMITS.budgetKB} kB, ${FIRST_LOAD_LIMITS.maxFiles} files).\n`,
  );
  // A part the first load takes in points at the entry, so it would be listed as "index"; it
  // loads at start, and its problem below says so.
  const opened = load.lazyParts.filter((key) => !load.files.includes(manifest[key]?.file ?? ''));
  process.stdout.write(`Loaded when opened: ${opened.map(partName).join(', ')}.\n`);
  const problems = firstLoadProblems({ ...load, kB }, FIRST_LOAD_LIMITS);
  problems.forEach((problem) => process.stdout.write(`${problem}\n`));
  if (problems.length > 0) process.exitCode = 1;
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

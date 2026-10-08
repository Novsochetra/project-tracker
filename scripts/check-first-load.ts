// Builds the web app into a temporary folder and fails when the JavaScript the first screen
// (Projects) loads grows past its budget, or takes in a part that should load when opened:
// npx tsx scripts/check-first-load.ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build, type Rolldown } from 'vite';

// Gzipped kB: 262.5 with every screen in one script, 206.5 after the split (PT-48). The room left
// is for small changes; one that needs more should load later, or raise this on purpose.
const BUDGET_KB = 215;
const LOADED_WHEN_OPENED = [
  'features/project/ProjectScreen.tsx',
  'features/ticket/TicketScreen.tsx',
  'features/project/NewTicketSheet.tsx',
  'features/claude/PromptSheet.tsx',
  'features/claude/ReportSheet.tsx',
  'features/statuses/StatusManagerSheet.tsx',
  'features/connect/ConnectSheet.tsx',
];
const WEB_ROOT = fileURLToPath(new URL('../apps/web', import.meta.url));

type Chunk = Rolldown.OutputChunk;

function firstLoad(chunks: Chunk[]): Chunk[] {
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const entry = chunks.find((chunk) => chunk.isEntry);
  if (!entry) throw new Error('The build has no entry chunk.');
  const loaded = new Set<Chunk>();
  const visit = (chunk: Chunk | undefined) => {
    if (!chunk || loaded.has(chunk)) return;
    loaded.add(chunk);
    chunk.imports.forEach((name) => visit(byName.get(name)));
  };
  visit(entry);
  return [...loaded];
}

async function buildChunks(): Promise<Chunk[]> {
  const outDir = mkdtempSync(join(tmpdir(), 'tracker-first-load-'));
  try {
    const result = await build({ root: WEB_ROOT, logLevel: 'error', build: { outDir } });
    const outputs = Array.isArray(result) ? result : [result];
    return outputs.flatMap((output) =>
      'output' in output
        ? output.output.filter((item): item is Chunk => item.type === 'chunk')
        : [],
    );
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

const chunks = firstLoad(await buildChunks());
const kB = chunks.reduce((sum, chunk) => sum + gzipSync(chunk.code).length, 0) / 1000;
const taken = LOADED_WHEN_OPENED.filter((part) =>
  chunks.some((chunk) => chunk.moduleIds.some((id) => id.endsWith(`/src/${part}`))),
);
process.stdout.write(`First-load JS: ${kB.toFixed(1)} kB gzipped (budget ${BUDGET_KB} kB).\n`);
if (kB > BUDGET_KB) {
  process.stdout.write('Load more of it when its screen or sheet opens, or raise the budget.\n');
  process.exitCode = 1;
}
if (taken.length > 0) {
  process.stdout.write(`Loaded at start but meant to load when opened: ${taken.join(', ')}.\n`);
  process.exitCode = 1;
}

// The parts of a Vite build manifest (build.manifest) that say which chunk loads which.
export interface ManifestChunk {
  file: string;
  isEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
}

export type Manifest = Record<string, ManifestChunk>;

export interface FirstLoad {
  files: string[];
  lazyParts: string[];
  taken: string[];
}

function reach(manifest: Manifest, starts: string[], next: (chunk: ManifestChunk) => string[]) {
  const seen = new Set<string>();
  const visit = (key: string) => {
    const chunk = manifest[key];
    if (!chunk || seen.has(key)) return;
    seen.add(key);
    next(chunk).forEach(visit);
  };
  starts.forEach(visit);
  return seen;
}

const imports = (chunk: ManifestChunk) => chunk.imports ?? [];
const dynamicImports = (chunk: ManifestChunk) => chunk.dynamicImports ?? [];

// A dynamic import of a module the first load also imports statically points at the chunk that
// holds it, which the first load has already loaded, so such a part is caught by where it points.
export function readFirstLoad(manifest: Manifest): FirstLoad {
  const entries = Object.keys(manifest).filter((key) => manifest[key]!.isEntry);
  if (entries.length === 0) throw new Error('The build manifest has no entry.');
  const first = reach(manifest, entries, imports);
  const all = reach(manifest, entries, (chunk) => [...imports(chunk), ...dynamicImports(chunk)]);
  const lazyParts = [...new Set([...all].flatMap((key) => dynamicImports(manifest[key]!)))];
  const fileOf = (key: string) => manifest[key]!.file;
  return {
    files: [...first].map(fileOf),
    lazyParts,
    taken: lazyParts.filter((key) => first.has(key)).map(fileOf),
  };
}

export function firstLoadProblems(
  { taken }: FirstLoad,
  { kB, budgetKB }: { kB: number; budgetKB: number },
): string[] {
  const problems = taken.map(
    (file) =>
      `Loaded at start but meant to load when opened: a dynamic import of ${file}, which the ` +
      'first load holds. Something there imports the part statically; ' +
      "Vite's INEFFECTIVE_DYNAMIC_IMPORT warning above names it.",
  );
  if (kB <= budgetKB) return problems;
  return [
    `First-load JS is past its ${budgetKB} kB budget: load more of it when its screen or sheet ` +
      'opens, or raise the budget.',
    ...problems,
  ];
}

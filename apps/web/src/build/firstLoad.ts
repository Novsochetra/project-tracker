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

export interface MeasuredFirstLoad extends FirstLoad {
  kB: number;
}

export interface FirstLoadLimits {
  budgetKB: number;
  maxFiles: number;
}

export const FIRST_LOAD_LIMITS: FirstLoadLimits = {
  // Gzipped kB: 262.5 with every screen in one script, 206.5 after the split (PT-48), 215.6 to
  // 201.1 with motion's m elements (PT-207). The room left is for small changes; one that needs
  // more should load later, or raise this on purpose.
  budgetKB: 215,
  // The entry and the chunk it shares with the lazy parts. Each 3rd file so far was shared code that
  // stopped folding into the entry: the people and statuses hooks (PT-98), the viewers without the
  // text preview (PT-103, +0.6 kB); 7 files cost 3.3 kB (PT-93). A wanted 3rd file raises this.
  maxFiles: 2,
};

const takenProblem = (file: string) =>
  `Loaded at start but meant to load when opened: a dynamic import of ${file}, which the ` +
  'first load holds. Something there imports the part statically; ' +
  "Vite's INEFFECTIVE_DYNAMIC_IMPORT warning above names it.";

// More files can cost more than their size shows: each is a request on a slow phone, and the split
// that makes them can also grow the total (PT-93: 2 files became 7, 207.3 kB became 210.6 kB).
export function firstLoadProblems(
  { files, taken, kB }: MeasuredFirstLoad,
  { budgetKB, maxFiles }: FirstLoadLimits,
): string[] {
  const problems: string[] = [];
  if (kB > budgetKB)
    problems.push(
      `First-load JS is past its ${budgetKB} kB budget: load more of it when its screen or sheet ` +
        'opens, or raise the budget.',
    );
  if (files.length > maxFiles)
    problems.push(
      `First-load JS is ${files.length} files, more than ${maxFiles} (${files.join(', ')}): ` +
        'code the first screen shares stopped folding into the entry. A likely cause is a barrel ' +
        'the first load imports that re-exports a module only a lazy part uses; import that ' +
        'module directly instead.',
    );
  return [...problems, ...taken.map(takenProblem)];
}

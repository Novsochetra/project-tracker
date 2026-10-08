// The encodings the web app's build writes copies in (apps/web/src/build/precompress.ts).
const COPIED = ['br', 'gzip'];

const weightOf = (params: string[]): number => {
  const q = params
    .map((param) => param.trim().toLowerCase())
    .find((param) => param.startsWith('q='));
  return q === undefined ? 1 : Number(q.slice(2));
};

export function acceptedEncodings(header: string): string[] {
  const weights = new Map<string, number>();
  for (const entry of header.split(',')) {
    const [coding = '', ...params] = entry.split(';');
    weights.set(coding.trim().toLowerCase(), weightOf(params));
  }
  const otherwise = weights.get('*') ?? 0;
  // A weight that isn't a number reads as NaN and refuses: the plain file is always safe.
  return COPIED.filter((coding) => (weights.get(coding) ?? otherwise) > 0);
}

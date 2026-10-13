const TITLE = '# Changelog';

export function changelogEntry(version: string, day: string, subjects: readonly string[]): string {
  const lines = subjects.map((subject) => `- ${subject}`);
  return [`## v${version} (${day})`, '', ...lines, ''].join('\n');
}

// Newest first: the entry goes above the previous release's heading.
export function addToChangelog(existing: string | null, entry: string): string {
  const text = existing?.trimEnd() ?? '';
  if (!text) return `${TITLE}\n\n${entry}`;
  const lines = text.split('\n');
  const first = lines.findIndex((line) => line.startsWith('## '));
  if (first === -1) return `${text}\n\n${entry}`;
  const before = lines.slice(0, first).join('\n').trimEnd();
  const after = lines.slice(first).join('\n');
  return `${before}\n\n${entry}\n${after}\n`;
}

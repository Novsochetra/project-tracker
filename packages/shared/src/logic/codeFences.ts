// CommonMark's rules, which the chat's Markdown follows too, so a block found here is one the
// person sees as code.
const OPEN = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

export interface CodeFence {
  start: number;
  // The closing line, or -1 when the block runs to the end.
  end: number;
  marker: string;
  info: string;
}

function opening(line: string): { marker: string; info: string } | null {
  const [, , marker = '', info = ''] = OPEN.exec(line) ?? [];
  if (!marker || (marker.startsWith('`') && info.includes('`'))) return null;
  return { marker, info: info.trim() };
}

function closingLine(lines: readonly string[], from: number, marker: string): number {
  for (let i = from; i < lines.length; i += 1) {
    const close = CLOSE.exec(lines[i] ?? '')?.[1];
    if (close && close[0] === marker[0] && close.length >= marker.length) return i;
  }
  return -1;
}

export function codeFences(lines: readonly string[]): CodeFence[] {
  const found: CodeFence[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const open = opening(lines[i] ?? '');
    if (!open) continue;
    const end = closingLine(lines, i + 1, open.marker);
    found.push({ start: i, end, ...open });
    if (end === -1) break;
    i = end;
  }
  return found;
}

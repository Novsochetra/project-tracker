import type { RefusedFile } from './attachmentFiles';

export interface FileNotice {
  problem: 'refused' | 'failed';
  names: string[];
  reasons: string[];
}

const VERBS: Record<FileNotice['problem'], string> = {
  refused: "can't be attached",
  failed: "didn't upload",
};

const unique = (items: readonly string[]): string[] => [...new Set(items)];

export function noticeTitle({ problem, names }: FileNotice): string {
  const more = names.length > 1 ? ` and ${names.length - 1} more` : '';
  return `${names[0] ?? 'A file'}${more} ${VERBS[problem]}.`;
}

export const noticeDetail = ({ reasons }: FileNotice): string => reasons.join(' ');

export function refusalNotice(refused: readonly RefusedFile[]): FileNotice | null {
  if (refused.length === 0) return null;
  return {
    problem: 'refused',
    names: refused.map((file) => file.name),
    reasons: unique(refused.map((file) => file.reason)),
  };
}

// Uploads that fail while the note is up, as all of them do when the connection drops, share it.
export function withFailure(notice: FileNotice | null, name: string, reason: string): FileNotice {
  if (notice?.problem !== 'failed') return { problem: 'failed', names: [name], reasons: [reason] };
  return {
    problem: 'failed',
    names: [...notice.names, name],
    reasons: unique([...notice.reasons, reason]),
  };
}

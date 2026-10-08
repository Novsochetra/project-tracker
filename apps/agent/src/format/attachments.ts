import { attachmentKind, type Attachment, type TicketDetail } from '@tracker/shared';
import { formatBytes, SEP } from './text';

export const MAX_TEXT_CHARS = 20_000;
// Claude Code caps a tool result at about 25,000 tokens by default, and images take room too.
export const TEXT_BUDGET_CHARS = 40_000;

export type TextFile =
  | { status: 'shown'; text: string; fullLength: number }
  | { status: 'skipped' }
  | { status: 'failed'; error: string };

export interface FileView {
  texts: ReadonlyMap<string, TextFile>;
  fileUrl(file: Attachment): string;
  usesToken: boolean;
}

export const NO_FILE_CONTENT: FileView = {
  texts: new Map(),
  fileUrl: (file) => file.url,
  usesToken: false,
};

export const TOKEN_NOTE =
  'Download links need the access token: send the header "Authorization: Bearer <TRACKER_TOKEN>".';

const NUMBER = new Intl.NumberFormat('en-US');

const SKIPPED_NOTE = `(not shown: the ${NUMBER.format(TEXT_BUDGET_CHARS)}-character limit for text files is used up)`;

// Each file once: the ticket's own, then each comment's, oldest first; the last list adds any file
// whose comment isn't in the activity, so none is left out.
export function ticketFiles(detail: TicketDetail): Attachment[] {
  const candidates = [
    ...detail.attachments.filter((file) => file.activityId === null),
    ...[...detail.activity]
      .sort((a, b) => a.createdAt - b.createdAt)
      .flatMap((item) => item.attachments),
    ...detail.attachments,
  ];
  const seen = new Set<string>();
  return candidates.filter((file) => {
    if (seen.has(file.id)) return false;
    seen.add(file.id);
    return true;
  });
}

function describeImage(image: Attachment): string {
  const parts = [image.fileName, formatBytes(image.size)];
  if (image.width && image.height) parts.push(`${image.width}×${image.height}`);
  return parts.join(SEP);
}

function fileNote(file: Attachment, view: FileView): string | null {
  const text = view.texts.get(file.id);
  if (text?.status === 'shown') return null;
  if (text?.status === 'failed') return `could not be loaded: ${text.error}`;
  const url = view.fileUrl(file);
  return text?.status === 'skipped' ? `${url} ${SKIPPED_NOTE}` : url;
}

export function describeAttachment(file: Attachment, view: FileView): string {
  if (attachmentKind(file.mimeType) === 'image') return describeImage(file);
  const note = fileNote(file, view);
  const parts = [file.fileName, file.mimeType, formatBytes(file.size)];
  return (note ? [...parts, note] : parts).join(SEP);
}

// A fence longer than any run of backticks inside, so the contents can't close it early.
const fenceFor = (text: string): string =>
  '`'.repeat(Math.max(3, ...(text.match(/`+/g) ?? []).map((run) => run.length + 1)));

function contentsOf(file: Attachment, view: FileView): string | null {
  const text = view.texts.get(file.id);
  if (text?.status !== 'shown') return null;
  const fence = fenceFor(text.text);
  const block = `Contents of ${file.fileName}:\n${fence}\n${text.text.replace(/\r?\n$/, '')}\n${fence}`;
  if (text.text.length === text.fullLength) return block;
  const shown = `${NUMBER.format(text.text.length)} of ${NUMBER.format(text.fullLength)}`;
  return `${block}\n(Cut after ${shown} characters. The whole file: ${view.fileUrl(file)})`;
}

export function formatAttachments(files: readonly Attachment[], view: FileView): string[] {
  const list = files.map((file) => `- ${describeAttachment(file, view)}`);
  const contents = files.flatMap((file) => {
    const block = contentsOf(file, view);
    return block ? ['', block] : [];
  });
  return [...list, ...contents];
}

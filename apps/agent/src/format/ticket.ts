import {
  attachmentKind,
  instructionsBlock,
  PRIORITY_LABELS,
  type TicketDetail,
} from '@tracker/shared';
import { formatActivity } from './activity';
import {
  formatAttachments,
  NO_FILE_CONTENT,
  ticketFiles,
  TOKEN_NOTE,
  type FileView,
} from './attachments';
import { SEP } from './text';

function fieldsLine({ ticket, status }: TicketDetail): string {
  return [
    `Status: ${status.name} (${status.category})`,
    `Priority: ${PRIORITY_LABELS[ticket.priority]}`,
    `Assignee: ${ticket.assignee || 'Unassigned'}`,
    `Due: ${ticket.due || 'None'}`,
  ].join(SEP);
}

function projectLine({ project }: TicketDetail): string {
  const parts = [`Project: ${project.name} (${project.key})`];
  if (project.repo) parts.push(`Repository: ${project.repo}`);
  return parts.join(SEP);
}

// Checked on the finished text, so the note follows wherever a link was printed.
const showsLink = (text: string, detail: TicketDetail, view: FileView): boolean =>
  ticketFiles(detail).some(
    (file) => attachmentKind(file.mimeType) !== 'image' && text.includes(view.fileUrl(file)),
  );

export function formatTicket(detail: TicketDetail, view: FileView = NO_FILE_CONTENT): string {
  const { ticket } = detail;
  const files = detail.attachments.filter((file) => file.activityId === null);
  const sections = [
    [`# ${ticket.key}: ${ticket.title || 'Untitled'}`, fieldsLine(detail), projectLine(detail)],
    instructionsBlock(detail.project, '##'),
    ['## Description', ticket.description.trim() || '(No description.)'],
  ].filter((lines) => lines.length > 0);
  if (files.length > 0) sections.push(['## Attachments', ...formatAttachments(files, view)]);
  sections.push(['## Activity (oldest first)', formatActivity(detail.activity, view)]);
  const text = sections.map((lines) => lines.join('\n')).join('\n\n');
  return view.usesToken && showsLink(text, detail, view) ? `${text}\n\n${TOKEN_NOTE}` : text;
}

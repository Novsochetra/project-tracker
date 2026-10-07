import { PRIORITY_LABELS, type TicketDetail } from '@tracker/shared';
import { formatActivity } from './activity';
import { formatImageList } from './images';
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

export function formatTicket(detail: TicketDetail): string {
  const { ticket } = detail;
  const images = detail.attachments.filter((image) => image.activityId === null);
  const sections = [
    [`# ${ticket.key}: ${ticket.title || 'Untitled'}`, fieldsLine(detail), projectLine(detail)],
    ['## Description', ticket.description.trim() || '(No description.)'],
  ];
  if (images.length > 0) sections.push(['## Images', ...formatImageList(images)]);
  sections.push(['## Activity (oldest first)', formatActivity(detail.activity)]);
  return sections.map((lines) => lines.join('\n')).join('\n\n');
}

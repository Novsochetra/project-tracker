import {
  HUMAN,
  type Activity,
  type Attachment,
  type Ticket,
  type TicketDetail,
  type UpdateTicketInput,
} from '@tracker/shared';
import { isEntry, isList } from '../../lib/entries';
import { ticketFields } from './fields';

export const TEMPORARY_ID_PREFIX = 'temp-';

export const isTemporaryId = (id: string): boolean => id.startsWith(TEMPORARY_ID_PREFIX);

export interface CommentDraft {
  id: string;
  text: string;
  attachments: Attachment[];
  createdAt: number;
}

export function withTicket(detail: TicketDetail, ticket: Ticket): TicketDetail {
  const status = detail.statuses.find((item) => item.id === ticket.statusId) ?? detail.status;
  return { ...detail, ticket, status };
}

export const patchTicketDetail = (detail: TicketDetail, input: UpdateTicketInput): TicketDetail =>
  withTicket(detail, { ...detail.ticket, ...ticketFields(input) });

export const draftComment = (detail: TicketDetail, draft: CommentDraft): Activity => ({
  ...draft,
  ticketId: detail.ticket.id,
  type: 'comment',
  actor: HUMAN,
  review: null,
  editedAt: null,
});

export const appendActivity = (detail: TicketDetail, activity: Activity): TicketDetail => ({
  ...detail,
  activity: [...detail.activity, activity],
});

// An entry the tracker sent that isn't an object, such as null, stays in the cache as it came
// (the activity list leaves it out), and finding a comment passes over it.
export const matchesActivity = (item: Activity, activityId: string | undefined): boolean =>
  isEntry(item) && item.id === activityId;

export const replaceActivity = (
  detail: TicketDetail,
  activityId: string,
  activity: Activity,
): TicketDetail => ({
  ...detail,
  activity: detail.activity.map((item) => (matchesActivity(item, activityId) ? activity : item)),
});

export const removeActivity = (detail: TicketDetail, activityId: string): TicketDetail => ({
  ...detail,
  activity: detail.activity.filter((item) => !matchesActivity(item, activityId)),
});

export const editActivityText = (
  detail: TicketDetail,
  activityId: string,
  text: string,
  editedAt: number,
): TicketDetail => ({
  ...detail,
  activity: detail.activity.map((item) =>
    matchesActivity(item, activityId) ? { ...item, text, editedAt } : item,
  ),
});

// A file entry this app can't read, such as null, stays in the cache as it came (the file lists
// leave it out), and adding or removing a file passes over it.
const matchesFile = (item: Attachment, attachmentId: string): boolean =>
  isEntry(item) && item.id === attachmentId;

export const addTicketAttachment = (detail: TicketDetail, attachment: Attachment): TicketDetail =>
  detail.attachments.some((item) => matchesFile(item, attachment.id))
    ? detail
    : { ...detail, attachments: [...detail.attachments, attachment] };

// An activity entry without a list of files stays as it came too.
export function removeAttachment(detail: TicketDetail, attachmentId: string): TicketDetail {
  const keep = (attachment: Attachment) => !matchesFile(attachment, attachmentId);
  const holdsIt = (item: Activity) =>
    isEntry(item) && isList(item.attachments) && !item.attachments.every(keep);
  return {
    ...detail,
    attachments: detail.attachments.filter(keep),
    activity: detail.activity.map((item) =>
      holdsIt(item) ? { ...item, attachments: item.attachments.filter(keep) } : item,
    ),
  };
}

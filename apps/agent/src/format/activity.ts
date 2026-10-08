import { VERDICT_LABELS, type Activity, type Review } from '@tracker/shared';
import { formatAttachments, NO_FILE_CONTENT, type FileView } from './attachments';
import { authorName, formatTime, SEP } from './text';

export const formatVerdict = (review: Review): string =>
  `${VERDICT_LABELS[review.verdict]}${SEP}★ ${review.rating}/5`;

const formatEvent = (item: Activity): string =>
  `- ${authorName(item.actor)} ${item.text}${SEP}${formatTime(item.createdAt)}`;

function formatCard(label: string, item: Activity, view: FileView): string {
  const parts = [label, authorName(item.actor)];
  if (item.review) parts.push(formatVerdict(item.review));
  parts.push(formatTime(item.createdAt));
  const lines = [`### ${parts.join(SEP)}${item.editedAt ? ' (edited)' : ''}`];
  const body = item.text.trim();
  if (body) lines.push(body);
  if (item.attachments.length > 0) {
    lines.push('Attachments:', ...formatAttachments(item.attachments, view));
  }
  return lines.join('\n');
}

function formatItem(item: Activity, view: FileView): string {
  switch (item.type) {
    case 'event':
      return formatEvent(item);
    case 'comment':
      return formatCard('Comment', item, view);
    case 'report':
      return formatCard('Report', item, view);
    case 'review':
      return formatCard('Review', item, view);
  }
}

export function formatActivity(
  activity: readonly Activity[],
  view: FileView = NO_FILE_CONTENT,
): string {
  if (activity.length === 0) return '(No activity yet.)';
  const sorted = [...activity].sort((a, b) => a.createdAt - b.createdAt);
  return sorted
    .map((item, index) => {
      const previous = sorted[index - 1];
      if (!previous) return formatItem(item, view);
      const gap = item.type === 'event' && previous.type === 'event' ? '\n' : '\n\n';
      return gap + formatItem(item, view);
    })
    .join('');
}

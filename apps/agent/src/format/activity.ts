import type { Activity, Review, ReviewVerdict } from '@tracker/shared';
import { formatImageList } from './images';
import { authorName, formatTime, SEP } from './text';

const VERDICT_LABELS: Record<ReviewVerdict, string> = {
  approved: 'Approved',
  changes_requested: 'Changes requested',
};

export const formatVerdict = (review: Review): string =>
  `${VERDICT_LABELS[review.verdict]}${SEP}★ ${review.rating}/5`;

const formatEvent = (item: Activity): string =>
  `- ${authorName(item.actor)} ${item.text}${SEP}${formatTime(item.createdAt)}`;

function formatCard(label: string, item: Activity): string {
  const parts = [label, authorName(item.actor)];
  if (item.review) parts.push(formatVerdict(item.review));
  parts.push(formatTime(item.createdAt));
  const lines = [`### ${parts.join(SEP)}${item.editedAt ? ' (edited)' : ''}`];
  const body = item.text.trim();
  if (body) lines.push(body);
  if (item.attachments.length > 0) lines.push('Images:', ...formatImageList(item.attachments));
  return lines.join('\n');
}

function formatItem(item: Activity): string {
  switch (item.type) {
    case 'event':
      return formatEvent(item);
    case 'comment':
      return formatCard('Comment', item);
    case 'report':
      return formatCard('Report', item);
    case 'review':
      return formatCard('Review', item);
  }
}

export function formatActivity(activity: readonly Activity[]): string {
  if (activity.length === 0) return '(No activity yet.)';
  const sorted = [...activity].sort((a, b) => a.createdAt - b.createdAt);
  return sorted
    .map((item, index) => {
      const previous = sorted[index - 1];
      if (!previous) return formatItem(item);
      const gap = item.type === 'event' && previous.type === 'event' ? '\n' : '\n\n';
      return gap + formatItem(item);
    })
    .join('');
}

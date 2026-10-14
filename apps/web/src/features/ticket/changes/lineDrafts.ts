import {
  draftIdOf,
  forgetDraft,
  keepDraft,
  storedDraft,
  storedDrafts,
  type DraftTarget,
} from '../../../lib/storedDrafts';

// A line's unsent comment is kept in the drafts store like the comment box's, so it outlives a
// reload and closing the page asks first; it is never sent for the person.
const targetOf = (ticketKey: string, lineId: string): DraftTarget => ({
  ticketKey,
  field: 'line-comment',
  activityId: lineId,
});

export const lineDraftText = (ticketKey: string, lineId: string): string =>
  storedDraft(draftIdOf(targetOf(ticketKey, lineId)))?.text ?? '';

export function keepLineDraft(ticketKey: string, lineId: string, text: string): void {
  const target = targetOf(ticketKey, lineId);
  if (text.trim()) keepDraft(draftIdOf(target), { ...target, text }, '');
  else forgetDraft(draftIdOf(target));
}

// One string, so a store change that leaves the set of lines alone renders nothing.
export const draftedLines = (ticketKey: string): string =>
  storedDrafts()
    .flatMap(([, draft]) =>
      draft.field === 'line-comment' && draft.ticketKey === ticketKey
        ? [draft.activityId ?? '']
        : [],
    )
    .sort()
    .join('\n');

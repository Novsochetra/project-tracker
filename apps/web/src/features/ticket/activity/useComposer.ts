import { useQueryClient } from '@tanstack/react-query';
import type { Attachment, TicketDetail } from '@tracker/shared';
import { useState, useSyncExternalStore } from 'react';
import { errorMessage, queryKeys, useAddComment } from '../../../api';
import { useToast } from '../../../components';
import { subscribeStoredDrafts } from '../../../lib/storedDrafts';
import { useAttachmentList, type AttachmentList } from '../../attachments';
import { useDraftMark } from '../../../lib/useDraftMark';
import { canSendComment, tooLongMessage } from './commentRules';
import {
  backIdsOf,
  commentsWithText,
  endSend,
  keepComment,
  keptComment,
  keptForm,
  startSend,
} from './sentComments';

export interface ComposerState {
  text: string;
  setText: (text: string) => void;
  attachments: Attachment[];
  files: AttachmentList;
  canSubmit: boolean;
  submit: () => void;
}

// Unsent text is kept in the drafts store until it is sent or emptied; it is never sent for
// the user. The box shows what the store keeps, so a comment another tab types, sends or empties
// shows here too, as in a field: neither tab types over a comment it hasn't shown. It also notes
// which comments that came back it shows, which typing takes into its text.
function useComposerText(ticketKey: string) {
  // Kept text of spaces only (the app never keeps one) counts as none.
  const kept = useSyncExternalStore(subscribeStoredDrafts, () => keptComment(ticketKey));
  const [box, setBox] = useState(() => ({ text: kept ?? '', backs: backIdsOf(ticketKey) }));
  if (keptForm(box.text) !== kept) setBox({ text: kept ?? '', backs: backIdsOf(ticketKey) });
  return {
    text: box.text,
    change: (next: string) => {
      keepComment(ticketKey, next, box.backs);
      setBox({ text: next, backs: [] });
    },
  };
}

export function useComposer(ticketKey: string): ComposerState {
  const composer = useComposerText(ticketKey);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const files = useAttachmentList(setAttachments, {
    owner: 'comment',
    attached: attachments.length,
  });
  const addComment = useAddComment();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const { text } = composer;
  const uploading = files.uploading.length;
  const canSubmit = canSendComment(text, attachments.length, uploading);
  // Typed text outlives a reload in the drafts store; pending files only live here.
  useDraftMark(`comment:${ticketKey}`, attachments.length + uploading > 0);

  const submit = () => {
    if (!canSubmit) return;
    const sent = { text: text.trim(), attachments };
    const tooLong = tooLongMessage(sent.text);
    if (tooLong) {
      show(tooLong, { kind: 'error' });
      return;
    }
    const detail = queryClient.getQueryData<TicketDetail>(queryKeys.ticket(ticketKey));
    const sending = startSend(
      ticketKey,
      sent.text,
      detail ? commentsWithText(detail, sent.text) : 0,
    );
    composer.change('');
    setAttachments([]);
    files.dismissNotice();
    void addComment.mutateAsync({ ticketKey, text: sent.text, attachments: sent.attachments }).then(
      () => endSend(sending, true),
      (error: unknown) => {
        show(errorMessage(error), { kind: 'error' });
        endSend(sending, false);
        setAttachments((current) => [...sent.attachments, ...current]);
      },
    );
  };

  return { text, setText: composer.change, attachments, files, canSubmit, submit };
}

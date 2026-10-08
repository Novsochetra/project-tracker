import type { Attachment } from '@tracker/shared';
import { useState } from 'react';
import { errorMessage, useAddComment } from '../../../api';
import { useToast } from '../../../components';
import {
  draftIdOf,
  forgetDraft,
  keepDraft,
  storedDraft,
  type DraftTarget,
} from '../../../lib/storedDrafts';
import { useAttachmentList, type AttachmentList } from '../../attachments';
import { useDraftMark } from '../../../lib/useDraftMark';
import { canSendComment } from './commentRules';

export interface ComposerState {
  text: string;
  setText: (text: string) => void;
  attachments: Attachment[];
  files: AttachmentList;
  canSubmit: boolean;
  submit: () => void;
}

// Unsent text is kept in the drafts store until it is sent or emptied; it is never sent for
// the user.
function useComposerText(ticketKey: string) {
  const target: DraftTarget = { ticketKey, field: 'comment' };
  const id = draftIdOf(target);
  const [text, setText] = useState(() => storedDraft(id)?.text ?? '');
  const keep = (next: string) => {
    if (next.trim()) keepDraft(id, { ...target, text: next }, '');
    else forgetDraft(id);
  };
  return {
    text,
    change: (next: string) => {
      keep(next);
      setText(next);
    },
    // Unless something new was typed meanwhile, also after the screen has closed.
    handBack: (sent: string) => {
      if (!storedDraft(id)) keep(sent);
      setText((current) => (current.trim() ? current : sent));
    },
  };
}

export function useComposer(ticketKey: string): ComposerState {
  const composer = useComposerText(ticketKey);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const files = useAttachmentList(setAttachments);
  const addComment = useAddComment();
  const { show } = useToast();
  const { text } = composer;
  const uploading = files.uploading.length;
  const canSubmit = canSendComment(text, attachments.length, uploading);
  // Typed text outlives a reload in the drafts store; pending files only live here.
  useDraftMark(`comment:${ticketKey}`, attachments.length + uploading > 0);

  const submit = () => {
    if (!canSubmit) return;
    const sent = { text: text.trim(), attachments };
    composer.change('');
    setAttachments([]);
    void addComment
      .mutateAsync({ ticketKey, text: sent.text, attachments: sent.attachments })
      .catch((error: unknown) => {
        show(errorMessage(error), { kind: 'error' });
        composer.handBack(sent.text);
        setAttachments((current) => [...sent.attachments, ...current]);
      });
  };

  return { text, setText: composer.change, attachments, files, canSubmit, submit };
}

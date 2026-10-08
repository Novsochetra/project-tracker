import type { Attachment } from '@tracker/shared';
import { useState } from 'react';
import { errorMessage, useAddComment, useDeleteAttachment } from '../../../api';
import { useToast } from '../../../components';
import {
  draftIdOf,
  forgetDraft,
  keepDraft,
  storedDraft,
  type DraftTarget,
} from '../../../lib/storedDrafts';
import { useImageUploads, type ImageUploads } from '../../attachments';
import { useDraftMark } from '../fields/useDraftMark';
import { canSendComment } from './commentRules';

export interface ComposerState {
  text: string;
  setText: (text: string) => void;
  images: Attachment[];
  uploads: ImageUploads;
  canSubmit: boolean;
  submit: () => void;
  removeImage: (attachmentId: string) => void;
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
  const [images, setImages] = useState<Attachment[]>([]);
  const uploads = useImageUploads({
    onUploaded: (image) => setImages((current) => [...current, image]),
  });
  const addComment = useAddComment();
  const deleteAttachment = useDeleteAttachment();
  const { show } = useToast();
  const { text } = composer;
  const canSubmit = canSendComment(text, images.length, uploads.uploading);
  // Typed text outlives a reload in the drafts store; pending images only live here.
  useDraftMark(`comment:${ticketKey}`, images.length > 0);

  const submit = () => {
    if (!canSubmit) return;
    const sent = { text: text.trim(), images };
    composer.change('');
    setImages([]);
    void addComment
      .mutateAsync({ ticketKey, text: sent.text, attachments: sent.images })
      .catch((error: unknown) => {
        show(errorMessage(error));
        composer.handBack(sent.text);
        setImages((current) => [...sent.images, ...current]);
      });
  };

  const removeImage = (attachmentId: string) => {
    setImages((current) => current.filter((image) => image.id !== attachmentId));
    // Pending uploads expire on the server anyway, so a failed cleanup needs no message.
    deleteAttachment.mutate({ attachmentId });
  };

  return { text, setText: composer.change, images, uploads, canSubmit, submit, removeImage };
}

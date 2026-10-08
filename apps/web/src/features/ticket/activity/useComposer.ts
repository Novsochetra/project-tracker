import type { Attachment } from '@tracker/shared';
import { useState } from 'react';
import { errorMessage, useAddComment, useDeleteAttachment } from '../../../api';
import { useToast } from '../../../components';
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

export function useComposer(ticketKey: string): ComposerState {
  const [text, setText] = useState('');
  const [images, setImages] = useState<Attachment[]>([]);
  const uploads = useImageUploads({
    onUploaded: (image) => setImages((current) => [...current, image]),
  });
  const addComment = useAddComment();
  const deleteAttachment = useDeleteAttachment();
  const { show } = useToast();
  const canSubmit = canSendComment(text, images.length, uploads.uploading);
  useDraftMark(`comment:${ticketKey}`, text.trim() !== '' || images.length > 0);

  const submit = () => {
    if (!canSubmit) return;
    const sent = { text: text.trim(), images };
    setText('');
    setImages([]);
    void addComment
      .mutateAsync({ ticketKey, text: sent.text, attachments: sent.images })
      .catch((error: unknown) => {
        show(errorMessage(error));
        // Hand the comment back unless something new was typed meanwhile.
        setText((current) => (current.trim() ? current : sent.text));
        setImages((current) => [...sent.images, ...current]);
      });
  };

  const removeImage = (attachmentId: string) => {
    setImages((current) => current.filter((image) => image.id !== attachmentId));
    // Pending uploads expire on the server anyway, so a failed cleanup needs no message.
    deleteAttachment.mutate({ attachmentId });
  };

  return { text, setText, images, uploads, canSubmit, submit, removeImage };
}

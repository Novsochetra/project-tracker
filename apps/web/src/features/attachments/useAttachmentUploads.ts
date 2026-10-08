import type { Attachment, AttachmentKind } from '@tracker/shared';
import { useEffect, useRef, useState } from 'react';
import { useDeleteAttachment, useUploadAttachment } from '../../api';
import { useLatest } from '../../lib/useLatest';
import { admitFiles, roomFor, type AdmittedFile, type FileLimit } from './attachmentFiles';
import type { FileNotice } from './fileNotice';
import { useFileNotice } from './useFileNotice';
import { usePickedOrder } from './usePickedOrder';

export interface UploadingFile {
  key: string;
  name: string;
  kind: AttachmentKind;
  size: number;
  progress: number;
  preview: string | null;
}

export interface AttachmentUploadOptions {
  ticketKey?: string | undefined;
  onUploaded?: (attachment: Attachment) => void;
  // A file that finishes ahead of those picked before it waits in its tile, so onUploaded gets
  // them in the order they were picked, and so does the ticket or comment they are created with.
  inPickedOrder?: boolean;
  // Unset for a ticket's own files, which go straight to it: only a create has a limit.
  limit?: FileLimit | undefined;
}

export interface AttachmentUploads {
  uploading: UploadingFile[];
  notice: FileNotice | null;
  add: (files: Iterable<File>) => void;
  cancel: (key: string) => void;
  cancelAll: () => void;
  dismissNotice: () => void;
}

const PERCENT = 100;

function previewOf({ file, kind }: AdmittedFile): string | null {
  if (kind !== 'image' && kind !== 'video') return null;
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null;
}

interface Finished {
  item: UploadingFile;
  attachment: Attachment | null;
}

const toUploading = (key: string, entry: AdmittedFile): UploadingFile => ({
  key,
  name: entry.file.name || entry.kind,
  kind: entry.kind,
  size: entry.file.size,
  progress: 0,
  preview: previewOf(entry),
});

function useUploadingList() {
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const setProgress = (key: string, fraction: number) => {
    // Whole percents, so a fast upload doesn't render on every progress event.
    const progress = Math.round(fraction * PERCENT) / PERCENT;
    setUploading((current) =>
      current.some((item) => item.key === key && item.progress !== progress)
        ? current.map((item) => (item.key === key ? { ...item, progress } : item))
        : current,
    );
  };
  const drop = (key: string) =>
    setUploading((current) => current.filter((item) => item.key !== key));
  return { uploading, setUploading, setProgress, drop };
}

export function useAttachmentUploads(options: AttachmentUploadOptions = {}): AttachmentUploads {
  const { ticketKey, limit } = options;
  const upload = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();
  const notices = useFileNotice();
  const list = useUploadingList();
  const onUploadedRef = useLatest(options.onUploaded);
  const controllers = useRef(new Map<string, AbortController>());
  const counter = useRef(0);
  const order = usePickedOrder<Finished>(options.inPickedOrder ?? false, ({ item, attachment }) => {
    list.drop(item.key);
    if (item.preview) URL.revokeObjectURL(item.preview);
    if (attachment) onUploadedRef.current?.(attachment);
  });
  const forget = (attachment: Attachment) =>
    deleteAttachment.mutate({ attachmentId: attachment.id, ticketKey });

  // Files waiting for a form that is gone have no home; ones for a ticket still belong to it.
  useEffect(() => {
    const running = controllers.current;
    return () => {
      if (!ticketKey) running.forEach((controller) => controller.abort());
    };
  }, [ticketKey]);

  const start = (entry: AdmittedFile) => {
    counter.current += 1;
    const item = toUploading(`upload-${counter.current}`, entry);
    const controller = new AbortController();
    controllers.current.set(item.key, controller);
    order.pick(item.key);
    list.setUploading((current) => [...current, item]);
    // mutateAsync, because callbacks passed to mutate only run for the latest call.
    void upload
      .mutateAsync({
        file: entry.file,
        ticketKey,
        signal: controller.signal,
        onProgress: (fraction) => list.setProgress(item.key, fraction),
      })
      .then(
        (attachment) => {
          if (!controller.signal.aborted) return attachment;
          // It got there before the stop did, so it goes again.
          forget(attachment);
          return null;
        },
        (error: unknown) => {
          if (!controller.signal.aborted) notices.failed(item.name, error);
          return null;
        },
      )
      .then((attachment) => {
        controllers.current.delete(item.key);
        order.settle(item.key, { item, attachment });
      });
  };

  const add = (files: Iterable<File>) => {
    const { admitted, refused } = admitFiles(files, roomFor(limit, list.uploading.length));
    notices.picked(refused);
    admitted.forEach(start);
  };

  const cancel = (key: string) => {
    controllers.current.get(key)?.abort();
    list.drop(key);
    const waiting = order.waiting(key);
    if (waiting?.attachment) {
      forget(waiting.attachment);
      order.settle(key, { ...waiting, attachment: null });
    }
  };

  const cancelAll = () => {
    controllers.current.forEach((controller) => controller.abort());
    order.clear().forEach(({ item, attachment }) => {
      if (attachment) forget(attachment);
      if (item.preview) URL.revokeObjectURL(item.preview);
    });
    list.setUploading([]);
  };

  return {
    uploading: list.uploading,
    notice: notices.notice,
    add,
    cancel,
    cancelAll,
    dismissNotice: notices.dismiss,
  };
}

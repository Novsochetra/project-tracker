import type { Attachment, AttachmentKind } from '@tracker/shared';
import { useEffect, useRef, useState } from 'react';
import { errorMessage, useDeleteAttachment, useUploadAttachment } from '../../api';
import { useToast } from '../../components';
import { useLatest } from '../../lib/useLatest';
import { admitFiles, type AdmittedFile } from './attachmentFiles';

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
}

export interface AttachmentUploads {
  uploading: UploadingFile[];
  add: (files: Iterable<File>) => void;
  cancel: (key: string) => void;
  cancelAll: () => void;
}

const PERCENT = 100;

function previewOf({ file, kind }: AdmittedFile): string | null {
  if (kind !== 'image' && kind !== 'video') return null;
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null;
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
  const { ticketKey } = options;
  const upload = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();
  const { show } = useToast();
  const list = useUploadingList();
  const onUploadedRef = useLatest(options.onUploaded);
  const controllers = useRef(new Map<string, AbortController>());
  const counter = useRef(0);

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
          // It got there before the stop did, so it goes again.
          if (controller.signal.aborted) {
            deleteAttachment.mutate({ attachmentId: attachment.id, ticketKey });
          } else onUploadedRef.current?.(attachment);
        },
        (error: unknown) => {
          if (!controller.signal.aborted) show(errorMessage(error), { kind: 'error' });
        },
      )
      .finally(() => {
        controllers.current.delete(item.key);
        list.drop(item.key);
        if (item.preview) URL.revokeObjectURL(item.preview);
      });
  };

  const add = (files: Iterable<File>) => {
    const { admitted, refusal } = admitFiles(files);
    if (refusal) show(refusal, { kind: 'error' });
    admitted.forEach(start);
  };

  const cancel = (key: string) => {
    controllers.current.get(key)?.abort();
    list.drop(key);
  };

  const cancelAll = () => {
    controllers.current.forEach((controller) => controller.abort());
    list.setUploading([]);
  };

  return { uploading: list.uploading, add, cancel, cancelAll };
}

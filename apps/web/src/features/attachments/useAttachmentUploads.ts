import type { Attachment } from '@tracker/shared';
import { useEffect, useRef } from 'react';
import { useDeleteAttachment, useUploadAttachment } from '../../api';
import { useLatest } from '../../lib/useLatest';
import { admitFiles, roomFor, type AdmittedFile, type FileLimit } from './attachmentFiles';
import type { FileNotice, Notices } from './fileNotice';
import { useFileNotice } from './useFileNotice';
import { usePickedOrder } from './usePickedOrder';
import { useUploadingList, type UploadingFile } from './useUploadingList';

export type { UploadingFile } from './useUploadingList';

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
  // A tile for each file still uploading and each that failed since the last pick, as picked.
  tiles: UploadingFile[];
  // Those still going, which Create and Comment wait for.
  uploading: UploadingFile[];
  notices: Notices;
  add: (files: Iterable<File>) => void;
  cancel: (key: string) => void;
  cancelAll: () => void;
  dismissNotice: (problem?: FileNotice['problem']) => void;
}

function previewOf({ file, kind }: AdmittedFile): string | null {
  if (kind !== 'image' && kind !== 'video') return null;
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null;
}

interface Finished {
  item: UploadingFile;
  attachment: Attachment | null;
  failed: boolean;
}

const toUploading = (key: string, entry: AdmittedFile): UploadingFile => ({
  key,
  name: entry.file.name || entry.kind,
  kind: entry.kind,
  size: entry.file.size,
  progress: 0,
  preview: previewOf(entry),
  failed: false,
});

interface UploadEnds {
  forget: (attachment: Attachment) => void;
  fail: (item: UploadingFile, error: unknown) => void;
}

// How an upload ends: in its attachment, stopped, or failed.
const ends = (item: UploadingFile, signal: AbortSignal, { forget, fail }: UploadEnds) =>
  [
    (attachment: Attachment): Finished => {
      if (!signal.aborted) return { item, attachment, failed: false };
      // It got there before the stop did, so it goes again.
      forget(attachment);
      return { item, attachment: null, failed: false };
    },
    (error: unknown): Finished => {
      if (signal.aborted) return { item, attachment: null, failed: false };
      fail(item, error);
      return { item, attachment: null, failed: true };
    },
  ] as const;

const byKey = (key: string) => (item: UploadingFile) => item.key === key;
const isFailed = (item: UploadingFile) => item.failed;

export function useAttachmentUploads(options: AttachmentUploadOptions = {}): AttachmentUploads {
  const { ticketKey, limit } = options;
  const upload = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();
  const notices = useFileNotice();
  const list = useUploadingList();
  const uploading = list.tiles.filter((item) => !item.failed);
  const onUploadedRef = useLatest(options.onUploaded);
  const controllers = useRef(new Map<string, AbortController>());
  const counter = useRef(0);
  const order = usePickedOrder<Finished>(options.inPickedOrder ?? false, (finished) => {
    const { item, attachment, failed } = finished;
    // An upload that fails late may have its note out of sight, so its tile stays and says so.
    if (failed) return;
    list.drop(byKey(item.key));
    if (item.preview) URL.revokeObjectURL(item.preview);
    if (attachment) onUploadedRef.current?.(attachment);
  });
  const forget = (attachment: Attachment) =>
    deleteAttachment.mutate({ attachmentId: attachment.id, ticketKey });
  const fail = (item: UploadingFile, error: unknown) => {
    notices.failed(item.name, error);
    list.fail(item.key);
  };

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
    list.add(item);
    // mutateAsync, because callbacks passed to mutate only run for the latest call.
    void upload
      .mutateAsync({
        file: entry.file,
        ticketKey,
        signal: controller.signal,
        onProgress: (fraction) => list.setProgress(item.key, fraction),
      })
      .then(...ends(item, controller.signal, { forget, fail }))
      .then((finished) => {
        controllers.current.delete(item.key);
        order.settle(item.key, finished);
      });
  };

  const add = (files: Iterable<File>) => {
    const { admitted, refused } = admitFiles(files, roomFor(limit, uploading.length));
    notices.picked(refused);
    list.drop(isFailed);
    admitted.forEach(start);
  };

  const cancel = (key: string) => {
    controllers.current.get(key)?.abort();
    list.drop(byKey(key));
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
    list.drop(() => true);
  };

  // A failed tile goes with the note that says why.
  const dismissNotice = (problem?: FileNotice['problem']) => {
    notices.dismiss(problem);
    if (problem !== 'refused') list.drop(isFailed);
  };

  return {
    tiles: list.tiles,
    uploading,
    notices: notices.notices,
    add,
    cancel,
    cancelAll,
    dismissNotice,
  };
}

import type { Attachment } from '@tracker/shared';
import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import type { ViewerImage } from '../../overlays';
import { watchMovingOn } from './movingOn';
import { useViewersSettled } from './useViewersSettled';
import {
  AttachmentViewerContext,
  toViewerImages,
  ViewerOpeningContext,
  type AttachmentViewerApi,
} from './viewerContext';
import { ImageViewer, preloadViewers, TextPreviewSheet, VideoViewer } from './viewerParts';
import { ViewerSlot } from './ViewerSlot';
import { viewerTarget, type ViewerTarget } from './viewerTarget';

interface Opens {
  open: boolean;
  opens: number;
}

interface ImagesState extends Opens {
  images: ViewerImage[];
  index: number;
}

interface FileState extends Opens {
  attachment: Attachment | null;
}

const NO_IMAGES: ImagesState = { images: [], index: 0, open: false, opens: 0 };
const NO_FILE: FileState = { attachment: null, open: false, opens: 0 };

const closed = <T extends Opens>(current: T): T =>
  current.open ? { ...current, open: false } : current;

const imagesOpened =
  (images: readonly Attachment[], index: number) =>
  (current: ImagesState): ImagesState => ({
    images: toViewerImages(images),
    index,
    open: true,
    opens: current.opens + 1,
  });

const fileOpened =
  (attachment: Attachment) =>
  (current: FileState): FileState => ({ attachment, open: true, opens: current.opens + 1 });

function openId(images: ImagesState, video: FileState, text: FileState): string | null {
  if (images.open) return images.images[images.index]?.id ?? null;
  if (video.open) return video.attachment?.id ?? null;
  return text.open ? (text.attachment?.id ?? null) : null;
}

// One set of viewers per screen: each keeps its own copy of what it shows, so a thumbnail that
// re-renders or remounts underneath (a comment draft replaced by the saved comment) never
// closes it.
export function AttachmentViewerProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<ImagesState>(NO_IMAGES);
  const [video, setVideo] = useState<FileState>(NO_FILE);
  const [text, setText] = useState<FileState>(NO_FILE);
  const api = useMemo<AttachmentViewerApi>(() => {
    // One at a time: while a viewer's code is on its way, the tiles under it still take taps.
    const show = (target: ViewerTarget) => {
      if (target.kind === 'link') return void window.open(target.url, '_blank', 'noopener');
      setImages(target.kind === 'image' ? imagesOpened(target.images, target.index) : closed);
      setVideo(target.kind === 'video' ? fileOpened(target.attachment) : closed);
      setText(target.kind === 'text' ? fileOpened(target.attachment) : closed);
    };
    return {
      open: (attachments, index) => {
        const target = viewerTarget(attachments, index);
        if (target) show(target);
      },
      prepare: preloadViewers,
    };
  }, []);
  const drop = useCallback(() => {
    setImages(closed);
    setVideo(closed);
    setText(closed);
  }, []);
  const settled = useViewersSettled(images.opens + video.opens + text.opens > 0);
  const opening = settled ? null : openId(images, video, text);
  const pending = opening !== null;
  // An open whose code is on its way is dropped once the person moves on (watchMovingOn). In the
  // layout phase, so the watch ends before an arriving viewer takes focus, which would drop it.
  useLayoutEffect(() => (pending ? watchMovingOn(drop) : undefined), [pending, drop]);
  const playing = video.attachment;
  return (
    <AttachmentViewerContext value={api}>
      <ViewerOpeningContext value={opening}>{children}</ViewerOpeningContext>
      <ViewerSlot
        name="Image viewer"
        settled={settled}
        opens={images.opens}
        open={images.open}
        failure="Couldn't open the image. Reload to try again."
      >
        <ImageViewer
          images={images.images}
          index={images.index}
          open={images.open}
          onClose={() => setImages(closed)}
          onIndexChange={(index) => setImages((current) => ({ ...current, index }))}
        />
      </ViewerSlot>
      <ViewerSlot
        name="Video viewer"
        settled={settled}
        opens={video.opens}
        open={video.open}
        failure="Couldn't play the video. Reload to try again."
      >
        <VideoViewer
          video={playing && { url: playing.url, label: playing.fileName }}
          open={video.open}
          onClose={() => setVideo(closed)}
        />
      </ViewerSlot>
      <ViewerSlot
        name="Text preview"
        settled={settled}
        opens={text.opens}
        open={text.open}
        failure="Couldn't open the file. Reload to try again."
      >
        <TextPreviewSheet
          attachment={text.attachment}
          open={text.open}
          onClose={() => setText(closed)}
        />
      </ViewerSlot>
    </AttachmentViewerContext>
  );
}

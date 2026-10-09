import type { Attachment } from '@tracker/shared';
import { useMemo, useState, type ReactNode } from 'react';
import type { ViewerImage } from '../../overlays';
import { AttachmentViewerContext, toViewerImages, type AttachmentViewerApi } from './viewerContext';
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
  const playing = video.attachment;
  return (
    <AttachmentViewerContext value={api}>
      {children}
      <ViewerSlot
        name="Image viewer"
        part={ImageViewer}
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
        part={VideoViewer}
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
        part={TextPreviewSheet}
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

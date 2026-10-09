import type { Attachment } from '@tracker/shared';
import { useMemo, useState, type ReactNode } from 'react';
import type { ViewerImage } from '../../overlays';
import { ImageViewer } from '../../overlays/ImageViewer';
import { VideoViewer } from '../../overlays/VideoViewer';
import { TextPreviewSheet } from './TextPreviewSheet';
import { AttachmentViewerContext, toViewerImages, type AttachmentViewerApi } from './viewerContext';
import { viewerTarget, type ViewerTarget } from './viewerTarget';

interface ImagesState {
  images: ViewerImage[];
  index: number;
  open: boolean;
}

interface FileState {
  attachment: Attachment | null;
  open: boolean;
}

const NO_IMAGES: ImagesState = { images: [], index: 0, open: false };
const NO_FILE: FileState = { attachment: null, open: false };

const closed = <T extends { open: boolean }>(current: T): T => ({ ...current, open: false });

// One set of viewers per screen: each keeps its own copy of what it shows, so a thumbnail that
// re-renders or remounts underneath (a comment draft replaced by the saved comment) never
// closes it.
export function AttachmentViewerProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<ImagesState>(NO_IMAGES);
  const [video, setVideo] = useState<FileState>(NO_FILE);
  const [text, setText] = useState<FileState>(NO_FILE);
  const api = useMemo<AttachmentViewerApi>(() => {
    const show = (target: ViewerTarget) => {
      switch (target.kind) {
        case 'image':
          return setImages({
            images: toViewerImages(target.images),
            index: target.index,
            open: true,
          });
        case 'video':
          return setVideo({ attachment: target.attachment, open: true });
        case 'text':
          return setText({ attachment: target.attachment, open: true });
        case 'link':
          return void window.open(target.url, '_blank', 'noopener');
      }
    };
    return {
      open: (attachments, index) => {
        const target = viewerTarget(attachments, index);
        if (target) show(target);
      },
    };
  }, []);
  const playing = video.attachment;
  return (
    <AttachmentViewerContext value={api}>
      {children}
      <ImageViewer
        images={images.images}
        index={images.index}
        open={images.open}
        onClose={() => setImages(closed)}
        onIndexChange={(index) => setImages((current) => ({ ...current, index }))}
      />
      <VideoViewer
        video={playing && { url: playing.url, label: playing.fileName }}
        open={video.open}
        onClose={() => setVideo(closed)}
      />
      <TextPreviewSheet
        attachment={text.attachment}
        open={text.open}
        onClose={() => setText(closed)}
      />
    </AttachmentViewerContext>
  );
}

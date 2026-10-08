import { useMemo, useState, type ReactNode } from 'react';
import { ImageViewer, type ViewerImage } from '../../overlays';
import { ImageViewerContext, type ImageViewerApi } from './viewerContext';

interface ViewerState {
  images: ViewerImage[];
  index: number;
  open: boolean;
}

const CLOSED: ViewerState = { images: [], index: 0, open: false };

// One viewer per screen: it keeps its own copy of the images, so a thumbnail that re-renders or
// remounts underneath (a comment draft replaced by the saved comment) never closes it.
export function ImageViewerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ViewerState>(CLOSED);
  const api = useMemo<ImageViewerApi>(
    () => ({ open: (images, index) => setState({ images, index, open: true }) }),
    [],
  );
  return (
    <ImageViewerContext value={api}>
      {children}
      <ImageViewer
        images={state.images}
        index={state.index}
        open={state.open}
        onClose={() => setState((current) => ({ ...current, open: false }))}
        onIndexChange={(index) => setState((current) => ({ ...current, index }))}
      />
    </ImageViewerContext>
  );
}

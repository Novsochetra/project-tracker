import { m } from 'motion/react';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { MotionScope } from '../lib/MotionScope';
import { useViewportSize } from '../gestures/useViewportSize';
import { usePrefersReducedMotion } from '../lib/media';
import styles from './ImageViewer.module.css';
import './tokens.css';
import { useOverlayBehavior } from './useOverlayBehavior';
import { usePresence } from './usePresence';
import { useSwipeDown } from './useSwipeDown';
import { useViewerPresence } from './useViewerPresence';
import { ViewerChrome } from './ViewerChrome';
import { useViewerValues } from './viewerValues';
import videoStyles from './VideoViewer.module.css';

export interface ViewerVideo {
  url: string;
  label: string;
}

export interface VideoViewerProps {
  video: ViewerVideo | null;
  open: boolean;
  onClose: () => void;
}

const stay = () => undefined;

// Opened by a tap, so the browser lets it start with sound; when it doesn't, the native play
// button is there.
function usePlayWhileOpen(ref: RefObject<HTMLVideoElement | null>, open: boolean): void {
  useLayoutEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!open) {
      video.pause();
      return;
    }
    const playing = video.play() as Promise<void> | undefined;
    playing?.catch(() => undefined);
  }, [ref, open]);
}

function VideoPanel({
  video,
  open,
  onClose,
  onExited,
}: VideoViewerProps & {
  video: ViewerVideo;
  onExited: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const viewport = useViewportSize();
  const values = useViewerValues();
  const panelRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dismissVelocityRef = useRef<number | null>(null);
  useViewerPresence({ open, values, viewport, reducedMotion, dismissVelocityRef, onExited });
  useSwipeDown(stageRef, {
    values,
    viewport,
    reducedMotion,
    onDismiss: (velocity) => {
      dismissVelocityRef.current = velocity;
      onClose();
    },
  });
  usePlayWhileOpen(videoRef, open);
  const trapKeys = useOverlayBehavior({ active: open, panelRef, onClose, focusInitial: false });
  return (
    <m.div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Video viewer"
      tabIndex={-1}
      className={styles.viewer}
      style={{ opacity: values.opacity }}
      inert={!open}
      onKeyDown={trapKeys}
    >
      <m.div className={styles.backdrop} style={{ opacity: values.backdrop }} />
      <m.div ref={stageRef} className={styles.stage} style={{ scale: values.stageScale }}>
        <m.div
          className={videoStyles.frame}
          style={{ x: values.x, y: values.y, scale: values.scale }}
        >
          {/* People's own recordings come without captions, so there is no track to offer. */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            className={videoStyles.video}
            src={video.url}
            aria-label={video.label}
            controls
            playsInline
            preload="metadata"
            tabIndex={0}
          />
        </m.div>
      </m.div>
      <ViewerChrome
        index={0}
        count={1}
        visible
        opacity={values.backdrop}
        onClose={onClose}
        onGo={stay}
      />
    </m.div>
  );
}

export function VideoViewer(props: VideoViewerProps) {
  const { mounted, onExited } = usePresence(props.open && props.video !== null);
  if (!mounted || !props.video) return null;
  return createPortal(
    <MotionScope>
      <VideoPanel {...props} video={props.video} onExited={onExited} />
    </MotionScope>,
    document.body,
  );
}

import { motion } from 'motion/react';
import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { clamp } from '../gestures/math';
import { useViewportSize } from '../gestures/useViewportSize';
import { fitSize, type Size } from '../gestures/zoomMath';
import { usePrefersReducedMotion } from '../lib/media';
import { uniqueKeys } from '../lib/uniqueKeys';
import styles from './ImageViewer.module.css';
import './tokens.css';
import { useOverlayBehavior } from './useOverlayBehavior';
import { usePresence } from './usePresence';
import { useViewerGestures } from './useViewerGestures';
import { useTrackSync, useViewerPresence } from './useViewerPresence';
import { pageStride } from './viewerModes';
import { ViewerChrome } from './ViewerChrome';
import type { ImageViewerProps, ViewerImage } from './viewerTypes';
import { ViewerSlide } from './ViewerSlide';
import { useViewerValues } from './viewerValues';

const NO_SIZE: Size = { width: 0, height: 0 };

function fittedSize(image: ViewerImage | undefined, natural: Record<string, Size>, viewport: Size) {
  if (!image) return NO_SIZE;
  const known =
    image.width && image.height ? { width: image.width, height: image.height } : natural[image.id];
  return known ? fitSize(known, viewport) : NO_SIZE;
}

function ViewerPanel(props: ImageViewerProps & { onExited: () => void }) {
  const { images, open, onClose, onIndexChange, onExited } = props;
  const count = images.length;
  const keys = uniqueKeys(images.map((image) => image.id));
  const index = clamp(props.index, 0, Math.max(0, count - 1));
  const reducedMotion = usePrefersReducedMotion();
  const viewport = useViewportSize();
  const values = useViewerValues();
  const panelRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dismissVelocityRef = useRef<number | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [natural, setNatural] = useState<Record<string, Size>>({});
  const onNaturalSize = useCallback((id: string, size: Size) => {
    setNatural((known) => (known[id] ? known : { ...known, [id]: size }));
  }, []);
  const base = fittedSize(images[index], natural, viewport);

  useViewerPresence({ open, values, viewport, reducedMotion, dismissVelocityRef, onExited });
  useTrackSync({ values, index, viewport, reducedMotion });
  useViewerGestures(stageRef, {
    values,
    index,
    count,
    viewport,
    base,
    reducedMotion,
    onIndexChange,
    onDismiss: (velocity) => {
      dismissVelocityRef.current = velocity;
      onClose();
    },
    onToggleChrome: () => setChromeVisible((visible) => !visible),
  });
  const trapKeys = useOverlayBehavior({ active: open, panelRef, onClose, focusInitial: false });
  const go = (next: number) => {
    if (next >= 0 && next < count && next !== index) onIndexChange(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    trapKeys(event);
    if (event.key === 'ArrowLeft') go(index - 1);
    if (event.key === 'ArrowRight') go(index + 1);
  };

  const stride = pageStride(viewport);
  return (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      tabIndex={-1}
      className={styles.viewer}
      style={{ opacity: values.opacity }}
      inert={!open}
      onKeyDown={onKeyDown}
    >
      <motion.div className={styles.backdrop} style={{ opacity: values.backdrop }} />
      <motion.div ref={stageRef} className={styles.stage} style={{ scale: values.stageScale }}>
        <motion.div className={styles.track} style={{ x: values.track }}>
          {images.map((image, i) => (
            <ViewerSlide
              key={keys[i]}
              image={image}
              left={i * stride}
              width={viewport.width}
              current={i === index}
              near={Math.abs(i - index) <= 1}
              fitted={fittedSize(image, natural, viewport)}
              values={values}
              onNaturalSize={onNaturalSize}
            />
          ))}
        </motion.div>
      </motion.div>
      <ViewerChrome
        index={index}
        count={count}
        visible={chromeVisible}
        opacity={values.backdrop}
        onClose={onClose}
        onGo={go}
      />
    </motion.div>
  );
}

export function ImageViewer(props: ImageViewerProps) {
  const { mounted, onExited } = usePresence(props.open && props.images.length > 0);
  if (!mounted) return null;
  return createPortal(<ViewerPanel {...props} onExited={onExited} />, document.body);
}

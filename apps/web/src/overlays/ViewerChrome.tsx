import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { m, type MotionValue } from 'motion/react';
import styles from './ImageViewer.module.css';

export interface ViewerChromeProps {
  index: number;
  count: number;
  visible: boolean;
  opacity: MotionValue<number>;
  onClose: () => void;
  onGo: (index: number) => void;
}

export function ViewerChrome({ index, count, visible, opacity, onClose, onGo }: ViewerChromeProps) {
  return (
    <m.div className={styles.chrome} style={{ opacity }}>
      <div className={styles.controls} data-hidden={visible ? undefined : ''}>
        <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
          <X size={20} strokeWidth={1.75} />
        </button>
        {count > 1 && (
          <>
            <div className={styles.counter} aria-live="polite">
              {index + 1} / {count}
            </div>
            <button
              type="button"
              className={styles.prev}
              aria-label="Previous image"
              disabled={index === 0}
              onClick={() => onGo(index - 1)}
            >
              <ChevronLeft size={20} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className={styles.next}
              aria-label="Next image"
              disabled={index === count - 1}
              onClick={() => onGo(index + 1)}
            >
              <ChevronRight size={20} strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>
    </m.div>
  );
}

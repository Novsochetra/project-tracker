import { m, type MotionStyle } from 'motion/react';
import { memo, type SyntheticEvent } from 'react';
import type { Size } from '../gestures/zoomMath';
import styles from './ImageViewer.module.css';
import type { ViewerImage } from './viewerTypes';
import type { ViewerValues } from './viewerValues';

export interface ViewerSlideProps {
  image: ViewerImage;
  left: number;
  width: number;
  current: boolean;
  near: boolean;
  fitted: Size;
  values: ViewerValues;
  onNaturalSize: (id: string, size: Size) => void;
}

const AT_REST: MotionStyle = { x: 0, y: 0, scale: 1 };

function ViewerSlideImpl(props: ViewerSlideProps) {
  const { image, left, width, current, near, fitted, values, onNaturalSize } = props;
  const onLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      onNaturalSize(image.id, { width: naturalWidth, height: naturalHeight });
    }
  };
  const zoom: MotionStyle = current ? { x: values.x, y: values.y, scale: values.scale } : AT_REST;
  const size = fitted.width > 0 ? { width: fitted.width, height: fitted.height } : {};
  return (
    <div className={styles.slide} style={{ left, width }} aria-hidden={current ? undefined : true}>
      {near && (
        <m.img
          src={image.url}
          alt={image.alt}
          draggable={false}
          decoding="async"
          className={styles.image}
          style={{ ...zoom, ...size }}
          onLoad={onLoad}
        />
      )}
    </div>
  );
}

export const ViewerSlide = memo(ViewerSlideImpl);

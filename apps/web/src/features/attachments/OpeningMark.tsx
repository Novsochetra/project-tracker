import clsx from 'clsx';
import { useLayoutEffect, useRef } from 'react';
import { Spinner } from '../../components';
import styles from './OpeningMark.module.css';
import './tokens.css';

// On the tapped tile while its viewer's code is on its way: mid-screen it could sit over another
// tile (PT-107). Quiet like a loading screen: a fast load shows nothing, a slow one a spinner after
// 400 ms. It takes no taps, so the tile and the screen stay usable meanwhile. On a file's tile it
// covers the icon, so the name stays readable.
export function OpeningMark({ overIcon }: { overIcon: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  // WebKit leaves an element added while a stylesheet loads unstyled and undrawn until the sheet is
  // in, and the press on the tile started the viewer part's: on an iPhone the spinner showed only
  // when the viewer could open anyway (PT-114). Asking for a box styles it at once, as WebKit
  // ignores a loading sheet for that. Its own styles are in the first load's CSS.
  useLayoutEffect(() => {
    ref.current?.getBoundingClientRect();
  }, []);
  return (
    <span ref={ref} className={clsx(styles.mark, overIcon && styles.overIcon, 'quiet-in')}>
      <span className={styles.badge}>
        <Spinner size={16} label="Opening" className={styles.spinner} />
      </span>
    </span>
  );
}

import { useState } from 'react';
import { DemoApp } from '../navigation/demo/DemoApp';
import styles from '../navigation/demo/demo.module.css';

const openedFromUrl = () => new URLSearchParams(window.location.search).has('gestures');

export function GesturesDemo() {
  const [open, setOpen] = useState(openedFromUrl);
  return (
    <section aria-labelledby="gestures-demo-title" className={styles.launcher}>
      <h2 id="gestures-demo-title">Gestures and navigation</h2>
      <p>
        A three-level stack with the nav bar, large title, bottom bar, sheets, action sheet, swipe
        rows, pull to refresh and the image viewer. Open it at 375px with touch emulation for the
        phone gestures, or at full width for the desktop dialogs and fades. Add ?gestures to the URL
        to open it straight away.
      </p>
      <button type="button" className={styles.tool} onClick={() => setOpen(true)}>
        Open phone demo
      </button>
      {open && <DemoApp onExit={() => setOpen(false)} />}
    </section>
  );
}

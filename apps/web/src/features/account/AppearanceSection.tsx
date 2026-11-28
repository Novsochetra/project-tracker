import { useId } from 'react';
import { setAppearanceChoice, useAppearanceChoice, type AppearanceChoice } from '../../appearance';
import { Segmented, type SegmentedOption } from '../../components/Segmented';
import styles from './AccountSheet.module.css';

const CHOICES: readonly SegmentedOption<AppearanceChoice>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// As iOS's Display & Brightness: System follows the device, including its switch at sunset.
export function AppearanceSection() {
  const headingId = useId();
  const noteId = useId();

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        Appearance
      </h2>
      <Segmented
        aria-label="Appearance"
        aria-describedby={noteId}
        className={styles.appearance}
        options={CHOICES}
        value={useAppearanceChoice()}
        onChange={setAppearanceChoice}
      />
      <p id={noteId} className={styles.note}>
        System follows this device&rsquo;s light or dark setting.
      </p>
    </section>
  );
}

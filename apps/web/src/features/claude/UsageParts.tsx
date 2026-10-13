import { Fragment } from 'react';
import styles from './UsageParts.module.css';

// A line that wraps breaks between parts only, never inside "26 turns", and the dot stays at the
// end of the line it follows.
export function UsageParts({ parts }: { parts: readonly string[] }) {
  return parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 && ' '}
      <span className={styles.part}>{index < parts.length - 1 ? `${part} ·` : part}</span>
    </Fragment>
  ));
}

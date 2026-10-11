import { MarkedText } from './MarkedText';
import styles from './Requests.module.css';

// One block a line, so a long line that wraps can't pass for the next line (Requests.module.css).
export function CodeLines({ text }: { text: string }) {
  return (
    <code className={styles.code}>
      {text.split('\n').map((line, index) => (
        <span key={index} className={styles.codeLine}>
          <MarkedText text={line} />
        </span>
      ))}
    </code>
  );
}

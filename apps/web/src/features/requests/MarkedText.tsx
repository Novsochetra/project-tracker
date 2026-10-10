import { markHidden } from './hiddenChars';
import styles from './Requests.module.css';

// What runs, shown exactly: a character that would hide or reorder text shows as its code.
export function MarkedText({ text }: { text: string }) {
  return (
    <>
      {markHidden(text).map((part, index) =>
        part.kind === 'hidden' ? (
          <span key={index} className={styles.hiddenChar}>
            {part.text}
          </span>
        ) : (
          part.text
        ),
      )}
    </>
  );
}

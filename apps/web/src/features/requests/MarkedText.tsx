import { markHidden } from './hiddenChars';
import styles from './Requests.module.css';

// What runs, shown exactly: a character that would hide or reorder text, or a letter that passes
// for one of another script, shows as its code.
export function MarkedText({ text }: { text: string }) {
  return (
    <>
      {markHidden(text).map((part, index) =>
        part.kind === 'text' ? (
          part.text
        ) : (
          <span key={index} className={styles.hiddenChar}>
            {part.text}
          </span>
        ),
      )}
    </>
  );
}

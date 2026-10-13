import { LinkedText } from '../ticket/activity/LinkedText';
import styles from './ChatScreen.module.css';

// Rendered as text and links only, as comments are, so nothing Claude writes becomes markup.
export function MessageText({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className={styles.text}>
      <LinkedText text={text} />
    </p>
  );
}

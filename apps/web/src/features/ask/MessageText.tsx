import { LinkedText } from '../ticket/activity/LinkedText';
import styles from './ChatScreen.module.css';

// A person's words show as written, with links, as comments do.
export function MessageText({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className={styles.text}>
      <LinkedText text={text} />
    </p>
  );
}

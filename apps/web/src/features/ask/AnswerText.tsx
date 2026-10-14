import { withoutImageCards } from '@tracker/shared';
import styles from './ChatScreen.module.css';
import { Markdown } from './markdown/Markdown';

// Claude's words, formatted; its image cards show as the pictures under the answer (PT-225).
export function AnswerText({ text }: { text: string }) {
  return <Markdown className={styles.text} text={withoutImageCards(text)} />;
}

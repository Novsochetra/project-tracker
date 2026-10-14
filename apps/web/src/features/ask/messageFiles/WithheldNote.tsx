import type { Attachment } from '@tracker/shared';
import styles from './WithheldNote.module.css';
import { withheldText } from './withheldText';

export function WithheldNote({ files }: { files: readonly Attachment[] }) {
  const text = withheldText(files);
  return text ? <p className={styles.note}>{text}</p> : null;
}

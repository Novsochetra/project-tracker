import { useSheets } from '../../app/sheets/context';
import styles from './PromptSheet.module.css';

export function SetupLine() {
  const sheets = useSheets();
  return (
    <p className={styles.help}>
      Run Claude Code from here:{' '}
      <button
        type="button"
        className={styles.setUp}
        onClick={() => sheets.open({ type: 'connect' })}
      >
        set up your computer
      </button>
    </p>
  );
}

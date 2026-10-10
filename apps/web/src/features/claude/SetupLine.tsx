import { useSheets } from '../../app/sheets/context';
import { Button } from '../../components';
import styles from './PromptSheet.module.css';

export function SetupLine() {
  const sheets = useSheets();
  return (
    <p className={styles.setupLine}>
      Run Claude Code from here:{' '}
      <Button
        variant="text"
        size="sm"
        className={styles.setUp}
        onClick={() => sheets.open({ type: 'connect' })}
      >
        set up your computer
      </Button>
    </p>
  );
}

import { Search } from 'lucide-react';
import { useSheets } from '../../app/sheets/context';
import { Icon } from '../../components';
import { isApplePlatform, shortcutHint } from './paletteShortcut';
import styles from './SearchButton.module.css';

export function SearchButton() {
  const sheets = useSheets();
  const apple = isApplePlatform();

  return (
    <button
      type="button"
      className={styles.button}
      aria-keyshortcuts={apple ? 'Meta+K' : 'Control+K'}
      onClick={() => sheets.open({ type: 'search' })}
    >
      <Icon icon={Search} className={styles.icon} />
      <span className={styles.label}>Search</span>
      <kbd className={styles.hint} aria-hidden="true">
        {shortcutHint(apple)}
      </kbd>
    </button>
  );
}

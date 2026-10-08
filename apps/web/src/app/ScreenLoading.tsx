import { Spinner } from '../components';
import styles from './ScreenLoading.module.css';

export function ScreenLoading() {
  return (
    <div className={styles.loading}>
      <Spinner />
    </div>
  );
}

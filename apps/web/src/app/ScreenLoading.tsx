import clsx from 'clsx';
import { Spinner } from '../components';
import styles from './ScreenLoading.module.css';

export function ScreenLoading() {
  return (
    <div className={clsx(styles.loading, 'quiet-in')}>
      <Spinner />
    </div>
  );
}

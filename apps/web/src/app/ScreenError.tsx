import { CircleAlert } from 'lucide-react';
import { Button, EmptyState } from '../components';
import { useNavigation } from '../navigation';
import styles from './ScreenError.module.css';

const reload = () => window.location.reload();

// The stack around a failed screen is untouched, so Back and the edge swipe still leave it.
export function ScreenError() {
  const { canGoBack, back } = useNavigation();
  return (
    <EmptyState
      icon={CircleAlert}
      title="Something went wrong"
      className={styles.error}
      action={
        <div className={styles.actions}>
          {canGoBack && <Button onClick={back}>Back</Button>}
          <Button variant="primary" onClick={reload}>
            Reload
          </Button>
        </div>
      }
    />
  );
}

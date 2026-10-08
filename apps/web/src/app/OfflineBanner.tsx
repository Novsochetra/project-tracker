import { WifiOff } from 'lucide-react';
import { useEffect } from 'react';
import { NETWORK_ERROR_MESSAGE } from '../api';
import { Icon } from '../components';
import { announce, clearAnnouncement } from './announce';
import styles from './OfflineBanner.module.css';
import { useShowsSavedData } from './useApiUnreachable';

const SAVED_DATA_MESSAGE = 'Offline — showing saved data';

export function OfflineBanner() {
  const message = useShowsSavedData() ? SAVED_DATA_MESSAGE : NETWORK_ERROR_MESSAGE;
  useEffect(() => {
    announce(message);
    return () => clearAnnouncement(message);
  }, [message]);
  return (
    <div className={styles.banner}>
      <Icon icon={WifiOff} size={14} />
      <span className={styles.text}>{message}</span>
    </div>
  );
}

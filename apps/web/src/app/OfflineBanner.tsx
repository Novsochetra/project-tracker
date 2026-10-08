import { WifiOff } from 'lucide-react';
import { useEffect } from 'react';
import { NETWORK_ERROR_MESSAGE } from '../api';
import { Icon } from '../components';
import { announce } from './announce';
import styles from './OfflineBanner.module.css';

export function OfflineBanner() {
  useEffect(() => announce(NETWORK_ERROR_MESSAGE), []);
  return (
    <div className={styles.banner}>
      <Icon icon={WifiOff} size={14} />
      <span className={styles.text}>{NETWORK_ERROR_MESSAGE}</span>
    </div>
  );
}

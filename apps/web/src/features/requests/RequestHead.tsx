import type { LucideIcon } from 'lucide-react';
import { Icon } from '../../components';
import styles from './Requests.module.css';

export function RequestHead({ icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <p className={styles.head}>
      <Icon icon={icon} size={14} />
      {text}
    </p>
  );
}

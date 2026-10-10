import clsx from 'clsx';
import { Check } from 'lucide-react';
import { Icon } from '../../components';
import styles from './Requests.module.css';

export function ChoiceMark({ round, on }: { round: boolean; on: boolean }) {
  return (
    <span className={clsx(styles.mark, round && styles.round)} aria-hidden="true">
      {on && <Icon icon={Check} size={14} />}
    </span>
  );
}

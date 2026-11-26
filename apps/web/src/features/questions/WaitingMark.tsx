import clsx from 'clsx';
import { MessageCircleQuestion } from 'lucide-react';
import { Icon } from '../../components';
import { WAITING_ROW_NAME, WAITING_ROW_TEXT } from './copy';
import styles from './WaitingMark.module.css';

export interface WaitingMarkProps {
  // A ticket's row and card take the size of the due date beside it.
  size?: 'secondary' | 'caption';
  className?: string | undefined;
}

export function WaitingMark({ size = 'secondary', className }: WaitingMarkProps) {
  return (
    <span className={clsx(styles.mark, styles[size], className)}>
      <Icon icon={MessageCircleQuestion} size={14} />
      <span aria-hidden="true">{WAITING_ROW_TEXT}</span>
      <span className="visually-hidden">{WAITING_ROW_NAME}</span>
    </span>
  );
}

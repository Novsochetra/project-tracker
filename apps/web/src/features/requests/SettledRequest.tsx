import type { RunRequest } from '@tracker/shared';
import {
  Check,
  CircleSlash,
  ClipboardList,
  Clock,
  MessageCircleQuestion,
  PencilLine,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Icon } from '../../components';
import { stepIcon } from '../steps/stepIcon';
import styles from './Requests.module.css';
import { outcomeLines, requestOutcome, subjectOf, type Outcome } from './requestText';

const OUTCOME_ICONS: Record<Outcome, LucideIcon> = {
  allowed: Check,
  answered: Check,
  denied: X,
  skipped: CircleSlash,
  none: Clock,
  approved: Check,
  planning: PencilLine,
};

const KIND_ICONS: Partial<Record<RunRequest['kind'], LucideIcon>> = {
  question: MessageCircleQuestion,
  plan: ClipboardList,
};

export interface SettledRequestProps {
  request: RunRequest;
  now: number;
  takeFocus: boolean;
}

export function SettledRequest({ request, now, takeFocus }: SettledRequestProps) {
  const outcomeRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (takeFocus) outcomeRef.current?.focus({ preventScroll: true });
  }, [takeFocus]);
  const outcome = requestOutcome(request, now);
  const subject = subjectOf(request);
  const icon = KIND_ICONS[request.kind] ?? stepIcon({ kind: 'tool', label: subject });
  return (
    <div className={`${styles.settledBody} fade-in`}>
      <p className={styles.subject}>
        <Icon icon={icon} size={14} className={styles.subjectIcon} />
        <span className={styles.subjectText}>{subject}</span>
      </p>
      <p ref={outcomeRef} tabIndex={-1} className={styles.outcome} data-outcome={outcome}>
        <Icon icon={OUTCOME_ICONS[outcome]} size={14} className={styles.outcomeIcon} />
        <span className={styles.outcomeLines}>
          {outcomeLines(request, now).map((line, index) => (
            <span key={index}>{line}</span>
          ))}
        </span>
      </p>
    </div>
  );
}

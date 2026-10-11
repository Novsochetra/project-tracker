import { Copy } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '../../components';
import { prefersReducedMotionNow } from '../../lib/media';
import { useCopyCommand, type CopyMessages } from '../connect/useCopyCommand';
import styles from './Invites.module.css';

export interface CreatedLinkProps {
  label: string;
  title: string;
  warning: string;
  link: string;
  copied: CopyMessages;
  onDone: () => void;
}

// The server keeps only the link's hash, so this is the one time anyone sees it.
export function CreatedLink({ label, title, warning, link, copied, onDone }: CreatedLinkProps) {
  const { copy, blocked } = useCopyCommand();
  const cardRef = useRef<HTMLDivElement>(null);
  // The button that made it is gone, so focus moves to the card, which also reads it out.
  useEffect(() => {
    const card = cardRef.current;
    card?.focus({ preventScroll: true });
    card?.scrollIntoView?.({
      block: 'nearest',
      behavior: prefersReducedMotionNow() ? 'instant' : 'smooth',
    });
  }, []);
  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      role="group"
      aria-label={label}
      className={`${styles.created} fade-in`}
    >
      <p className={styles.createdTitle}>{title}</p>
      <code className={styles.link}>{link}</code>
      <p className={styles.warning}>{warning}</p>
      <div className={styles.actions}>
        <Button size="sm" icon={Copy} onClick={() => copy(link, copied)}>
          Copy link
        </Button>
        <Button size="sm" variant="text" onClick={onDone}>
          Done
        </Button>
      </div>
      {blocked && (
        <p role="alert" className={`${styles.error} fade-in`}>
          {blocked}
        </p>
      )}
    </div>
  );
}

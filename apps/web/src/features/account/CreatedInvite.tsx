import { Copy } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '../../components';
import { prefersReducedMotionNow } from '../../lib/media';
import { useCopyCommand } from '../connect/useCopyCommand';
import { INVITE_COPY } from './inviteText';
import styles from './Invites.module.css';

export interface CreatedInviteProps {
  link: string;
  onDone: () => void;
}

// The server keeps only the link's hash, so this is the one time anyone sees it.
export function CreatedInvite({ link, onDone }: CreatedInviteProps) {
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
      aria-label="New invite link"
      className={`${styles.created} fade-in`}
    >
      <p className={styles.createdTitle}>The invite link is ready</p>
      <code className={styles.link}>{link}</code>
      <p className={styles.warning}>Copy it now and send it to one person.</p>
      <div className={styles.actions}>
        <Button size="sm" icon={Copy} onClick={() => copy(link, INVITE_COPY)}>
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

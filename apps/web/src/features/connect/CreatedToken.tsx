import type { CreatedApiToken } from '@tracker/shared';
import { Copy } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '../../components';
import shared from './ConnectSheet.module.css';
import { TOKEN_COPY } from './tokenText';
import styles from './Tokens.module.css';
import { useCopyCommand } from './useCopyCommand';

export interface CreatedTokenProps {
  created: CreatedApiToken;
  onDone: () => void;
}

// The server keeps only the token's hash, so this is the one time anyone sees it.
export function CreatedToken({ created, onDone }: CreatedTokenProps) {
  const { copy, blocked } = useCopyCommand();
  const cardRef = useRef<HTMLDivElement>(null);
  // The form that made it is gone, so focus moves to the card, which also reads it out.
  useEffect(() => cardRef.current?.focus({ preventScroll: true }), []);
  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      role="group"
      aria-label={`New token ${created.token.name}`}
      className={`${styles.created} fade-in`}
    >
      <p className={styles.createdTitle}>“{created.token.name}” is ready</p>
      <code className={styles.secret}>{created.secret}</code>
      <p className={styles.warning}>Copy it now. You won’t see this token again.</p>
      <div className={styles.createdActions}>
        <Button size="sm" icon={Copy} onClick={() => copy(created.secret, TOKEN_COPY)}>
          Copy token
        </Button>
        <Button size="sm" variant="text" onClick={onDone}>
          Done
        </Button>
      </div>
      {blocked && (
        <p role="alert" className={`${shared.error} fade-in`}>
          {blocked}
        </p>
      )}
    </div>
  );
}

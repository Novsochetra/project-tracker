import type { ApiToken } from '@tracker/shared';
import { useState, type MouseEvent } from 'react';
import { errorMessage } from '../../api';
import { useRevokeApiToken } from '../../api/hooks/apiTokens';
import { Button, ConfirmCard, useToast } from '../../components';
import { holdPresses } from '../../lib/holdPresses';
import shared from './ConnectSheet.module.css';
import { revokeMessage, tokenDetails } from './tokenText';
import styles from './Tokens.module.css';

export interface TokenRowProps {
  token: ApiToken;
  now: number;
}

export function TokenRow({ token, now }: TokenRowProps) {
  const [confirming, setConfirming] = useState(false);
  const revoke = useRevokeApiToken();
  const toast = useToast();
  // The confirm takes the row's place, its Revoke about where the row's was, so the second tap of
  // a double tap would revoke the token without a real confirm.
  const ask = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) holdPresses(event.currentTarget);
    setConfirming(true);
  };
  const confirm = () =>
    revoke.mutate(token.id, { onSuccess: () => toast.show(`Revoked “${token.name}”`) });
  if (confirming) {
    return (
      <li className={styles.confirmRow}>
        <ConfirmCard
          variant="menu"
          message={revokeMessage(token.name)}
          confirmLabel="Revoke"
          pending={revoke.isPending}
          onConfirm={confirm}
          onCancel={() => setConfirming(false)}
        />
        {revoke.error && (
          <p role="alert" className={`${shared.error} fade-in`}>
            {errorMessage(revoke.error)}
          </p>
        )}
      </li>
    );
  }
  return (
    <li className={shared.row}>
      <span className={shared.rowText}>
        <span className={styles.name}>{token.name}</span>
        <span className={shared.rowDescription}>{tokenDetails(token, now)}</span>
      </span>
      <Button
        variant="text"
        tone="danger"
        size="sm"
        aria-label={`Revoke ${token.name}`}
        onClick={ask}
      >
        Revoke
      </Button>
    </li>
  );
}

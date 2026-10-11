import type { Invite } from '@tracker/shared';
import { errorMessage } from '../../api';
import { useRevokeInvite } from '../../api/hooks/invites';
import { Button, useToast } from '../../components';
import { inviteDetails } from './inviteText';
import styles from './Invites.module.css';

export function InviteRow({ invite }: { invite: Invite }) {
  const revoke = useRevokeInvite();
  const toast = useToast();
  const cancel = () =>
    revoke.mutate(invite.id, { onSuccess: () => toast.show('Invite cancelled') });
  return (
    <li className={styles.row}>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>Invite link</span>
        <span className={styles.rowDescription}>{inviteDetails(invite)}</span>
        {revoke.error && (
          <span role="alert" className={`${styles.error} fade-in`}>
            {errorMessage(revoke.error)}
          </span>
        )}
      </span>
      <Button
        variant="text"
        tone="danger"
        size="sm"
        disabled={revoke.isPending}
        aria-label={`Cancel invite link, ${inviteDetails(invite)}`}
        onClick={cancel}
      >
        Cancel
      </Button>
    </li>
  );
}

import type { InvitedUser } from '@tracker/shared';
import { errorMessage } from '../../api';
import { useCancelResetLink } from '../../api/hooks/invitedUsers';
import { Button, useToast } from '../../components';
import styles from './Invites.module.css';
import { personDetails, personName } from './peopleText';

export interface PersonRowProps {
  user: InvitedUser;
  making: boolean;
  onReset: () => void;
}

export function PersonRow({ user, making, onReset }: PersonRowProps) {
  const cancel = useCancelResetLink();
  const toast = useToast();
  const name = personName(user);
  const cancelLink = () =>
    cancel.mutate(user.id, { onSuccess: () => toast.show('Reset link cancelled') });
  return (
    <li className={styles.row}>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{name}</span>
        <span className={styles.rowDescription}>{personDetails(user)}</span>
        {cancel.error && (
          <span role="alert" className={`${styles.error} fade-in`}>
            {errorMessage(cancel.error)}
          </span>
        )}
      </span>
      {user.resetExpiresAt === null ? (
        <Button
          variant="text"
          size="sm"
          disabled={making}
          aria-label={`Make a reset link for ${name}`}
          onClick={onReset}
        >
          Reset link
        </Button>
      ) : (
        <Button
          variant="text"
          tone="danger"
          size="sm"
          disabled={cancel.isPending}
          aria-label={`Cancel the reset link for ${name}`}
          onClick={cancelLink}
        >
          Cancel link
        </Button>
      )}
    </li>
  );
}

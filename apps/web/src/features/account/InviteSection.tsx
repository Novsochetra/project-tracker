import { useId } from 'react';
import { errorMessage } from '../../api';
import { useCreateInvite, useInvites } from '../../api/hooks/invites';
import { Button, GroupedCard } from '../../components';
import { CreatedInvite } from './CreatedInvite';
import { InviteRow } from './InviteRow';
import { inviteLinkFor } from './inviteText';
import styles from './Invites.module.css';

function OpenInvites() {
  const invites = useInvites();
  if (!invites.data?.length) return null;
  return (
    <GroupedCard>
      <ul className={styles.rows} aria-label="Open invite links">
        {invites.data.map((invite) => (
          <InviteRow key={invite.id} invite={invite} />
        ))}
      </ul>
    </GroupedCard>
  );
}

export function InviteSection() {
  const create = useCreateInvite();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        Invite someone
      </h2>
      <p className={styles.note}>
        An invite link lets one person make an account here. It works once, for 7 days. They see
        only the projects they make.
      </p>
      {create.data ? (
        <CreatedInvite
          link={inviteLinkFor(create.data.secret, window.location.origin)}
          onDone={() => create.reset()}
        />
      ) : (
        <Button size="lg" fullWidth disabled={create.isPending} onClick={() => create.mutate()}>
          Make an invite link
        </Button>
      )}
      {create.error && (
        <p role="alert" className={`${styles.error} fade-in`}>
          {errorMessage(create.error)}
        </p>
      )}
      <OpenInvites />
    </section>
  );
}

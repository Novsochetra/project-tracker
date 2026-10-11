import { useId } from 'react';
import { errorMessage } from '../../api';
import { useInvitedUsers, useMakeResetLink } from '../../api/hooks/invitedUsers';
import { GroupedCard } from '../../components';
import { CreatedLink } from './CreatedLink';
import styles from './Invites.module.css';
import { personName, RESET_COPY, resetLinkFor } from './peopleText';
import { PersonRow } from './PersonRow';

export function PeopleSection() {
  const users = useInvitedUsers();
  const make = useMakeResetLink();
  const headingId = useId();
  if (!users.data?.length) return null;
  const madeFor = users.data.find((user) => user.id === make.variables);
  const name = madeFor ? personName(madeFor) : 'this person';
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        People
      </h2>
      <p className={styles.note}>
        A reset link lets one person set a new password, and signs them out everywhere. It works
        once, for 24 hours.
      </p>
      {make.data && (
        <CreatedLink
          label="New reset link"
          title={`The reset link for ${name} is ready`}
          warning={`Copy it now and send it only to ${name}.`}
          link={resetLinkFor(make.data.secret, window.location.origin)}
          copied={RESET_COPY}
          onDone={() => make.reset()}
        />
      )}
      {make.error && (
        <p role="alert" className={`${styles.error} fade-in`}>
          {errorMessage(make.error)}
        </p>
      )}
      <GroupedCard>
        <ul className={styles.rows} aria-label="People">
          {users.data.map((user) => (
            <PersonRow
              key={user.id}
              user={user}
              making={make.isPending}
              onReset={() => make.mutate(user.id)}
            />
          ))}
        </ul>
      </GroupedCard>
    </section>
  );
}

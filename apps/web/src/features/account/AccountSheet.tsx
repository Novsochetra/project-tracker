import { useState } from 'react';
import { errorMessage, useKnownSession, useLogout, useSignOutEverywhere } from '../../api';
import type { SheetProps } from '../../app/sheets/types';
import { Button, ConfirmCard } from '../../components';
import { Sheet, SheetTextButton } from '../../overlays';
import styles from './AccountSheet.module.css';
import { InviteSection } from './InviteSection';

export function AccountSheet({ open, onClose }: SheetProps) {
  const session = useKnownSession();
  const logout = useLogout();
  const everywhere = useSignOutEverywhere();
  const [confirming, setConfirming] = useState(false);
  const pending = logout.isPending || everywhere.isPending;
  const error = logout.error ?? everywhere.error;
  // The sign-in screen takes over once the session says signed out; the sheet goes with it.
  const signOut = (mutation: typeof logout) => mutation.mutate(undefined, { onSuccess: onClose });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Account"
      title="Account"
      left={<SheetTextButton onClick={onClose}>Close</SheetTextButton>}
    >
      <div className={styles.body}>
        <p className={styles.signedIn}>
          Signed in as <span className={styles.email}>{session?.email ?? 'the owner'}</span>
        </p>
        <section className={styles.section}>
          <Button size="lg" fullWidth disabled={pending} onClick={() => signOut(logout)}>
            Sign out
          </Button>
          <p className={styles.note}>Signs out this browser.</p>
        </section>
        <section className={styles.section}>
          {confirming ? (
            <ConfirmCard
              message="Sign out every phone and browser, this one too?"
              confirmLabel="Sign out everywhere"
              pending={everywhere.isPending}
              onConfirm={() => signOut(everywhere)}
              onCancel={() => setConfirming(false)}
            />
          ) : (
            <Button
              size="lg"
              tone="danger"
              fullWidth
              disabled={pending}
              onClick={() => setConfirming(true)}
            >
              Sign out everywhere
            </Button>
          )}
          <p className={styles.note}>
            For a lost phone. Claude Code agents keep working with their API tokens.
          </p>
        </section>
        {session?.role === 'owner' && <InviteSection />}
        {error && (
          <p role="alert" className={`${styles.error} fade-in`}>
            {errorMessage(error)}
          </p>
        )}
      </div>
    </Sheet>
  );
}

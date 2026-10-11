import { formatFullDate, INVITE_LINK_FAILED, PASSWORD_MIN } from '@tracker/shared';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { errorMessage, useKnownSession, useLogout } from '../api';
import { useCheckInvite } from '../api/hooks/invites';
import { Button, LogoGlyph, Spinner } from '../components';
import { AuthField } from './AuthField';
import { inviteSecretOf } from './inviteSecret';
import styles from './LoginScreen.module.css';
import { useInviteForm } from './useInviteForm';

function InviteLayout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <main className={styles.screen}>
      <div className={styles.form} role="group" aria-label={label}>
        <LogoGlyph className={styles.logo} />
        {children}
      </div>
    </main>
  );
}

function InviteProblem({ message }: { message: string }) {
  const navigate = useNavigate();
  return (
    <InviteLayout label="Invite">
      <h1 className={styles.title}>Join Tracker</h1>
      <p role="alert" className={styles.setup}>
        {message}
      </p>
      <Button size="lg" fullWidth onClick={() => void navigate('/', { replace: true })}>
        Go to sign in
      </Button>
    </InviteLayout>
  );
}

// A new account here would leave the signed-in person's data in this browser's offline copy.
function SignOutFirst({ email }: { email: string | undefined }) {
  const logout = useLogout();
  return (
    <InviteLayout label="Invite">
      <h1 className={styles.title}>Join Tracker</h1>
      <p className={styles.setup}>
        You are signed in{email ? ` as ${email}` : ''}. Sign out to make a new account with this
        invite.
      </p>
      <Button size="lg" fullWidth disabled={logout.isPending} onClick={() => logout.mutate()}>
        Sign out
      </Button>
      {logout.error && (
        <p role="alert" className={styles.error}>
          {errorMessage(logout.error)}
        </p>
      )}
    </InviteLayout>
  );
}

function InviteForm({ secret, expiresAt }: { secret: string; expiresAt: number }) {
  const form = useInviteForm(secret);
  const { accept, errorId } = form;
  return (
    <main className={styles.screen}>
      <form
        className={styles.form}
        onSubmit={form.submit}
        noValidate
        aria-label="Make your account"
      >
        <LogoGlyph className={styles.logo} />
        <h1 className={styles.title}>Join Tracker</h1>
        <p className={styles.setup}>
          Make your account. This invite works once, until {formatFullDate(expiresAt)}.
        </p>
        <div className={styles.fields}>
          <AuthField
            label="Name"
            name="name"
            autoComplete="name"
            enterKeyHint="next"
            aria-describedby={errorId}
            value={form.name}
            onChange={form.setName}
          />
          <AuthField
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            aria-describedby={errorId}
            value={form.email}
            onChange={form.setEmail}
          />
          <AuthField
            label={`Password (at least ${PASSWORD_MIN} characters)`}
            type="password"
            name="password"
            autoComplete="new-password"
            enterKeyHint="go"
            aria-describedby={errorId}
            value={form.password}
            onChange={form.setPassword}
          />
        </div>
        {accept.error && (
          <p id={errorId} role="alert" className={styles.error}>
            {errorMessage(accept.error)}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={accept.isPending}>
          {accept.isPending ? 'Making your account…' : 'Make account'}
        </Button>
      </form>
    </main>
  );
}

export function InviteScreen() {
  const secret = inviteSecretOf(useLocation().hash);
  const session = useKnownSession();
  const check = useCheckInvite(secret);
  if (session?.authRequired && session.authenticated) return <SignOutFirst email={session.email} />;
  if (secret === '') return <InviteProblem message={INVITE_LINK_FAILED} />;
  if (check.isError) return <InviteProblem message={errorMessage(check.error)} />;
  if (!check.data) {
    return (
      <InviteLayout label="Invite">
        <Spinner label="Checking the invite" />
      </InviteLayout>
    );
  }
  return <InviteForm secret={secret} expiresAt={check.data.expiresAt} />;
}

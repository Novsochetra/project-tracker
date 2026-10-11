import { formatFullDate, PASSWORD_MIN, RESET_LINK_FAILED } from '@tracker/shared';
import { useLocation } from 'react-router';
import { errorMessage } from '../api';
import { useCheckResetLink } from '../api/hooks/passwords';
import { Button, LogoGlyph, Spinner } from '../components';
import { AuthField } from './AuthField';
import { GoToSignIn, LinkLayout, LinkProblem } from './LinkLayout';
import { linkSecretOf } from './linkSecret';
import styles from './LoginScreen.module.css';
import { useResetForm } from './useResetForm';

const TITLE = 'Set a new password';

function PasswordSet() {
  return (
    <LinkLayout label="Password reset">
      <h1 className={styles.title}>Password set</h1>
      <p role="status" className={styles.setup}>
        Sign in with your new password. Every phone and browser that was signed in is signed out.
        Then check Connect for API tokens you don't recognize.
      </p>
      <GoToSignIn />
    </LinkLayout>
  );
}

interface ResetFormProps {
  secret: string;
  email: string;
  expiresAt: number;
}

function ResetForm({ secret, email, expiresAt }: ResetFormProps) {
  const form = useResetForm(secret);
  const { reset, errorId } = form;
  if (reset.isSuccess) return <PasswordSet />;
  return (
    <main className={styles.screen}>
      <form className={styles.form} onSubmit={form.submit} noValidate aria-label={TITLE}>
        <LogoGlyph className={styles.logo} />
        <h1 className={styles.title}>{TITLE}</h1>
        <p className={styles.setup}>
          For {email}. This link works once, until {formatFullDate(expiresAt)}.
        </p>
        <div className={styles.fields}>
          {/* Lets a password manager save the new password for the right account. */}
          <input type="hidden" name="username" autoComplete="username" value={email} />
          <AuthField
            label={`New password (at least ${PASSWORD_MIN} characters)`}
            type="password"
            name="password"
            autoComplete="new-password"
            enterKeyHint="go"
            aria-describedby={errorId}
            value={form.password}
            onChange={form.setPassword}
          />
        </div>
        {reset.error && (
          <p id={errorId} role="alert" className={styles.error}>
            {errorMessage(reset.error)}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={reset.isPending}>
          {reset.isPending ? 'Setting the password…' : 'Set password'}
        </Button>
      </form>
    </main>
  );
}

const ResetProblem = ({ message }: { message: string }) => (
  <LinkProblem label="Password reset" title={TITLE} message={message} />
);

export function ResetScreen() {
  const secret = linkSecretOf(useLocation().hash);
  const check = useCheckResetLink(secret);
  if (secret === '') return <ResetProblem message={RESET_LINK_FAILED} />;
  if (check.isError) return <ResetProblem message={errorMessage(check.error)} />;
  if (!check.data) {
    return (
      <LinkLayout label="Password reset">
        <Spinner label="Checking the reset link" />
      </LinkLayout>
    );
  }
  return <ResetForm secret={secret} {...check.data} />;
}

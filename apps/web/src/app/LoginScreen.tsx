import { useEffect, type ComponentProps } from 'react';
import { errorMessage } from '../api';
import { Button, LogoGlyph } from '../components';
import { useIsPhone } from '../lib/media';
import styles from './LoginScreen.module.css';
import { useLoginForm } from './useLoginForm';

export const SETUP_COMMAND = 'npm run owner:set -- --email you@example.com';

export interface LoginScreenProps {
  setupRequired: boolean;
}

interface FieldProps extends Omit<ComponentProps<'input'>, 'onChange'> {
  label: string;
  onChange: (value: string) => void;
}

function Field({ label, onChange, ...input }: FieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input
        className={styles.input}
        onChange={(event) => onChange(event.currentTarget.value)}
        {...input}
      />
    </label>
  );
}

// The page keeps its address while signed out, so after signing in the app opens right there.
export function LoginScreen({ setupRequired }: LoginScreenProps) {
  const form = useLoginForm();
  const { email, password, setEmail, setPassword, login, errorId, submit, nextOnReturn } = form;
  const { emailRef, passwordRef } = form;
  const isPhone = useIsPhone();
  // Like the sheets: focus on desktop only, so the phone keyboard doesn't jump up on its own.
  useEffect(() => {
    if (!isPhone) emailRef.current?.focus();
  }, [isPhone, emailRef]);
  return (
    <main className={styles.screen}>
      <form className={styles.form} onSubmit={submit} noValidate aria-label="Sign in">
        <LogoGlyph className={styles.logo} />
        <h1 className={styles.title}>Sign in to Tracker</h1>
        {setupRequired && (
          <p className={styles.setup}>
            No owner account yet. On the server, run{' '}
            <code className={styles.command}>{SETUP_COMMAND}</code>, then sign in here.
          </p>
        )}
        <div className={styles.fields}>
          <Field
            ref={emailRef}
            label="Email"
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            aria-describedby={errorId}
            value={email}
            onChange={setEmail}
            onKeyDown={nextOnReturn}
          />
          <Field
            ref={passwordRef}
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            enterKeyHint="go"
            aria-describedby={errorId}
            value={password}
            onChange={setPassword}
          />
        </div>
        {login.error && (
          <p id={errorId} role="alert" className={styles.error}>
            {errorMessage(login.error)}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  );
}

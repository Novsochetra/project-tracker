import { useEffect, useRef, useState, type FormEvent } from 'react';
import { errorMessage, useLogin } from '../api';
import { Button, LogoGlyph } from '../components';
import { useIsPhone } from '../lib/media';
import styles from './TokenScreen.module.css';

export function TokenScreen() {
  const [token, setToken] = useState('');
  const login = useLogin();
  const inputRef = useRef<HTMLInputElement>(null);
  const isPhone = useIsPhone();
  // Like the sheets: focus on desktop only, so the phone keyboard doesn't jump up on its own.
  useEffect(() => {
    if (!isPhone) inputRef.current?.focus();
  }, [isPhone]);
  const blank = token.trim() === '';
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!blank && !login.isPending) login.mutate({ token });
  };
  return (
    <main className={styles.screen}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <LogoGlyph className={styles.logo} />
        <h1 className={styles.title}>Enter your access token</h1>
        <input
          ref={inputRef}
          type="password"
          className={styles.input}
          aria-label="Access token"
          autoComplete="current-password"
          value={token}
          onChange={(event) => {
            setToken(event.currentTarget.value);
            login.reset();
          }}
        />
        {login.error && (
          <p role="alert" className={styles.error}>
            {errorMessage(login.error)}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={blank || login.isPending}
        >
          Continue
        </Button>
      </form>
    </main>
  );
}

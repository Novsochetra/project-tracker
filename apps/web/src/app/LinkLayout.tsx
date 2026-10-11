import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button, LogoGlyph } from '../components';
import styles from './LoginScreen.module.css';

export function LinkLayout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <main className={styles.screen}>
      <div className={styles.form} role="group" aria-label={label}>
        <LogoGlyph className={styles.logo} />
        {children}
      </div>
    </main>
  );
}

export function GoToSignIn() {
  const navigate = useNavigate();
  return (
    <Button size="lg" fullWidth onClick={() => void navigate('/', { replace: true })}>
      Go to sign in
    </Button>
  );
}

export interface LinkProblemProps {
  label: string;
  title: string;
  message: string;
}

export function LinkProblem({ label, title, message }: LinkProblemProps) {
  return (
    <LinkLayout label={label}>
      <h1 className={styles.title}>{title}</h1>
      <p role="alert" className={styles.setup}>
        {message}
      </p>
      <GoToSignIn />
    </LinkLayout>
  );
}

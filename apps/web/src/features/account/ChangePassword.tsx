import { PASSWORD_MIN } from '@tracker/shared';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../api';
import { Button, useToast } from '../../components';
import styles from './AccountSheet.module.css';
import password from './Password.module.css';
import { PasswordField } from './PasswordField';
import { usePasswordChange } from './usePasswordChange';

const NOTE = 'Other phones and browsers are signed out. Claude Code agents keep their API tokens.';

function PasswordForm({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const form = usePasswordChange(() => {
    toast.show('Password changed');
    onClose();
  });
  const { change, errorId } = form;
  const formRef = useRef<HTMLFormElement>(null);
  // The button that opened the form is gone, so focus moves to its first field.
  useEffect(() => {
    formRef.current?.querySelector('input')?.focus();
  }, []);
  return (
    <form
      ref={formRef}
      className={`${password.form} fade-in`}
      onSubmit={form.submit}
      noValidate
      aria-label="Change password"
    >
      <PasswordField
        label="Current password"
        name="current-password"
        autoComplete="current-password"
        enterKeyHint="next"
        aria-describedby={errorId}
        value={form.currentPassword}
        onChange={form.setCurrent}
      />
      <PasswordField
        label={`New password (at least ${PASSWORD_MIN} characters)`}
        name="new-password"
        autoComplete="new-password"
        enterKeyHint="done"
        aria-describedby={errorId}
        value={form.newPassword}
        onChange={form.setNew}
      />
      {change.error && (
        <p id={errorId} role="alert" className={`${styles.error} fade-in`}>
          {errorMessage(change.error)}
        </p>
      )}
      <div className={password.actions}>
        <Button type="submit" variant="primary" disabled={change.isPending}>
          {change.isPending ? 'Changing…' : 'Change password'}
        </Button>
        <Button variant="text" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ChangePassword() {
  const [open, setOpen] = useState(false);
  return (
    <section className={styles.section}>
      {open ? (
        <PasswordForm onClose={() => setOpen(false)} />
      ) : (
        <Button size="lg" fullWidth onClick={() => setOpen(true)}>
          Change password
        </Button>
      )}
      <p className={styles.note}>{NOTE}</p>
    </section>
  );
}

import { API_TOKEN_NAME_MAX, type CreatedApiToken } from '@tracker/shared';
import { Plus } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { errorMessage } from '../../api';
import { useCreateApiToken } from '../../api/hooks/apiTokens';
import { Button } from '../../components';
import shared from './ConnectSheet.module.css';
import { CreatedToken } from './CreatedToken';
import styles from './Tokens.module.css';

export function NewToken() {
  const create = useCreateApiToken();
  const [name, setName] = useState('');
  const [created, setCreated] = useState<CreatedApiToken | null>(null);
  const errorId = useId();
  if (created) return <CreatedToken created={created} onDone={() => setCreated(null)} />;
  const trimmed = name.trim();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed || create.isPending) return;
    create.mutate(
      { name: trimmed },
      {
        onSuccess: (answer) => {
          setName('');
          setCreated(answer);
        },
      },
    );
  };
  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-label="New API token">
      <div className={styles.formRow}>
        <input
          className={styles.input}
          aria-label="Token name"
          aria-describedby={create.error ? errorId : undefined}
          placeholder="Name, like Claude laptop"
          maxLength={API_TOKEN_NAME_MAX}
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Button type="submit" icon={Plus} disabled={!trimmed || create.isPending}>
          {create.isPending ? 'Creating…' : 'Create token'}
        </Button>
      </div>
      {create.error && (
        <p id={errorId} role="alert" className={`${shared.error} fade-in`}>
          {errorMessage(create.error)}
        </p>
      )}
    </form>
  );
}

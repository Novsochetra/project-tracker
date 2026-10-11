import { useId, useState, type FormEvent } from 'react';
import { useResetPassword } from '../api/hooks/passwords';

export function useResetForm(secret: string) {
  const [password, setPassword] = useState('');
  const reset = useResetPassword();
  const errorId = useId();
  const edit = (value: string) => {
    setPassword(value);
    if (reset.isError) reset.reset();
  };
  // The server checks the length and says what is wrong, as it does for invites.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (reset.isPending) return;
    reset.mutate({ secret, password });
  };
  return {
    password,
    setPassword: edit,
    reset,
    errorId: reset.error ? errorId : undefined,
    submit,
  };
}

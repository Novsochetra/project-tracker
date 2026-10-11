import { useId, useState, type FormEvent } from 'react';
import { useChangePassword } from '../../api/hooks/passwords';

export function usePasswordChange(onChanged: () => void) {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const change = useChangePassword();
  const errorId = useId();
  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    if (change.isError) change.reset();
  };
  // The server checks both and says what is wrong, as it does for invites.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (change.isPending) return;
    change.mutate({ currentPassword, newPassword }, { onSuccess: onChanged });
  };
  return {
    currentPassword,
    newPassword,
    setCurrent: edit(setCurrent),
    setNew: edit(setNew),
    change,
    errorId: change.error ? errorId : undefined,
    submit,
  };
}

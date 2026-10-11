import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAcceptInvite } from '../api/hooks/invites';

export function useInviteForm(secret: string) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const accept = useAcceptInvite();
  const navigate = useNavigate();
  const errorId = useId();
  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    if (accept.isError) accept.reset();
  };
  // The server checks every field and says what is wrong, as it does for owner-set.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (accept.isPending) return;
    const input = { secret, name, email: email.trim(), password };
    accept.mutate(input, { onSuccess: () => void navigate('/', { replace: true }) });
  };
  return {
    name,
    email,
    password,
    setName: edit(setName),
    setEmail: edit(setEmail),
    setPassword: edit(setPassword),
    accept,
    errorId: accept.error ? errorId : undefined,
    submit,
  };
}

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLogin } from '../api';

export function useLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    if (login.isError) login.reset();
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (login.isPending) return;
    // Return in a field that is still empty goes to it rather than sending half a sign-in.
    if (email.trim() === '') return emailRef.current?.focus();
    if (password === '') return passwordRef.current?.focus();
    login.mutate({ email, password });
  };
  // Return in the email field moves on to the password, as the keyboard's Next key says.
  const nextOnReturn = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || password !== '' || email.trim() === '') return;
    event.preventDefault();
    passwordRef.current?.focus();
  };
  return {
    email,
    password,
    setEmail: edit(setEmail),
    setPassword: edit(setPassword),
    emailRef,
    passwordRef,
    login,
    errorId: login.error ? errorId : undefined,
    submit,
    nextOnReturn,
  };
}

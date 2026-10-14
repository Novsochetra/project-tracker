import type { ChatChanges } from '@tracker/shared';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../../../api';
import { useCommitChat, useOpenPullRequest } from '../../../api/hooks/chatChanges';
import {
  commitInput,
  commitProblem,
  initialBranch,
  initialPicks,
  type CommitValues,
} from './commitValues';

export type ChangesStep = 'view' | 'commit' | 'pull_request';

const EMPTY: CommitValues = { message: '', branch: '', picks: new Set() };

export function useChangesSheet(chatId: string, chatTitle: string, changes: ChatChanges) {
  const [step, setStep] = useState<ChangesStep>('view');
  const [values, setValues] = useState<CommitValues>(EMPTY);
  const [prTitle, setPrTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const commit = useCommitChat(chatId);
  const pullRequest = useOpenPullRequest(chatId);
  const go = (next: ChangesStep) => {
    setError(null);
    setStep(next);
  };
  const sent = { onSuccess: () => go('view'), onError: (e: Error) => setError(errorMessage(e)) };

  const startCommit = () => {
    const branch = initialBranch(changes, chatTitle);
    setValues({ message: chatTitle, branch, picks: initialPicks(changes.files) });
    go('commit');
  };
  const startPullRequest = () => {
    setPrTitle(chatTitle);
    go('pull_request');
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 'pull_request') {
      const title = prTitle.trim();
      if (!title) return setError('Give the pull request a title.');
      return pullRequest.mutate({ version: changes.version, title, confirm: true }, sent);
    }
    const problem = commitProblem(values, changes);
    if (problem) return setError(problem);
    commit.mutate(commitInput(values, changes), sent);
  };
  return {
    step,
    values,
    setValues,
    prTitle,
    setPrTitle,
    error,
    pending: commit.isPending || pullRequest.isPending,
    startCommit,
    startPullRequest,
    back: () => go('view'),
    submit,
  };
}

export type ChangesSheetState = ReturnType<typeof useChangesSheet>;

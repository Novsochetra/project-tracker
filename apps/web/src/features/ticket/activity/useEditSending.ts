import { useRef, type Dispatch, type SetStateAction } from 'react';
import { NETWORK_ERROR_MESSAGE } from '../../../api';
import { useToast } from '../../../components';
import {
  draftSaved,
  forgetDraft,
  keepDraft,
  storedDraft,
  type DraftTarget,
} from '../../../lib/storedDrafts';
import { useLatest } from '../../../lib/useLatest';
import { useDraftCheck } from '../drafts/useDraftCheck';
import { useDraftSave } from '../drafts/useDraftSave';
import {
  afterCheck,
  afterSave,
  checkApplies,
  checkStep,
  withPhase,
  type EditState,
  type SentBy,
} from './commentEdit';

export interface SendingInput {
  id: string;
  target: DraftTarget;
  base: string;
  edit: EditState;
  text: string;
  setEdit: Dispatch<SetStateAction<EditState>>;
  editComment: (text: string) => Promise<boolean>;
}

export interface EditSending {
  send: (text: string) => void;
  sendChecked: (text: string) => void;
  retry: () => void;
}

type Send = (text: string, by: SentBy) => void;

// Once Save is pressed, the app may send the text for the user until it is saved.
function useEditSend({ id, target, base, setEdit, editComment }: SendingInput) {
  const saveDraft = useDraftSave();
  const submit = (text: string) => keepDraft(id, { ...target, text, submitted: true }, base);
  const send: Send = (text, by) => {
    submit(text);
    setEdit((current) => withPhase(current, 'saving'));
    const request =
      by === 'app'
        ? saveDraft({ ...target, text, base }).then(
            () => true,
            () => false,
          )
        : editComment(text);
    void request.then((saved) => {
      if (saved) draftSaved(id, text);
      // Cancelling mid-save dropped the kept text, but a failed edit reopens the editor with it.
      else if (!storedDraft(id)) submit(text);
      setEdit((current) => afterSave(current, saved));
    });
  };
  return { submit, send };
}

// The app retries one check at a time; the user's Save always gets a check of its own.
function useEditCheck(input: SendingInput & { send: Send }): (by: SentBy) => void {
  const check = useDraftCheck(input.target.ticketKey);
  const latest = useLatest(input);
  const retryingRef = useRef(false);
  const { show } = useToast();
  return (by) => {
    if (by === 'app' && retryingRef.current) return;
    if (by === 'app') retryingRef.current = true;
    void check(input.id).then((result) => {
      if (by === 'app') retryingRef.current = false;
      const now = latest.current;
      if (!checkApplies(now.edit, by)) return;
      if (result === 'unreachable' && by === 'user') show(NETWORK_ERROR_MESSAGE, { kind: 'error' });
      const step = checkStep(result);
      if (step === 'send') now.send(now.text, by);
      else if (step === 'drop') forgetDraft(input.id);
      now.setEdit((current) => afterCheck(current, step));
    });
  };
}

export function useEditSending(input: SendingInput): EditSending {
  const { submit, send } = useEditSend(input);
  const checkThenSend = useEditCheck({ ...input, send });
  return {
    send: (text) => send(text, 'user'),
    sendChecked: (text) => {
      submit(text);
      input.setEdit((current) => withPhase(current, 'saving'));
      checkThenSend('user');
    },
    retry: () => checkThenSend('app'),
  };
}

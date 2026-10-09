import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { isStaleEdit, NETWORK_ERROR_MESSAGE } from '../../../api';
import { useToast } from '../../../components';
import { forgetDraft, keepDraft, storedDraft, type DraftTarget } from '../../../lib/storedDrafts';
import { useLatest } from '../../../lib/useLatest';
import { useDraftCheck } from '../drafts/useDraftCheck';
import { useDraftSave } from '../drafts/useDraftSave';
import { finishSave, savesOf, startSave } from '../fields/fieldSaves';
import {
  afterCheck,
  afterSave,
  checkApplies,
  checkStep,
  withPhase,
  type EditState,
  type SendResult,
  type SentBy,
} from './commentEdit';

export interface SendingInput {
  id: string;
  target: DraftTarget;
  base: string;
  edit: EditState;
  text: string;
  setEdit: Dispatch<SetStateAction<EditState>>;
  // `expected`: the text the edit was typed over.
  editComment: (text: string, expected: string) => Promise<SendResult>;
}

export interface EditSending {
  send: (text: string) => void;
  sendChecked: (text: string) => void;
  retry: () => void;
}

type Send = (text: string, by: SentBy) => void;

const resultOf = (error: unknown): SendResult => (isStaleEdit(error) ? 'stale' : 'failed');

// An editor that has gone (the ticket was left) leaves its edit to the store: an editor opened
// again since, or another tab, may have newer text there, which its answer must not replace.
function useMounted(): RefObject<boolean> {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

// Once Save is pressed, the app may send the text for the user until it is saved. It names the
// text the edit was typed over: the kept base, which Save in 'changed' moves to theirs.
function useEditSend(input: SendingInput) {
  const { id, target, base, setEdit, editComment } = input;
  const saveDraft = useDraftSave();
  const latest = useLatest(input);
  const mounted = useMounted();
  const submit = (text: string) => keepDraft(id, { ...target, text, submitted: true }, base);
  // What the editor shows now: text typed since Save is newer than the text sent. An emptied
  // editor keeps the sent text, as a comment needs text.
  const keepShown = (sent: string) => {
    const shown = latest.current.text;
    keepDraft(id, { ...target, text: shown.trim() ? shown : sent, changed: true }, base);
  };
  const request = (text: string, by: SentBy): Promise<SendResult> => {
    const expected = storedDraft(id)?.base ?? base;
    return by === 'app'
      ? saveDraft({ ...target, text, base: expected }).then(() => 'saved' as const, resultOf)
      : editComment(text, expected);
  };
  const settle = (text: string, result: SendResult) => {
    // Another tab's edit landed first. This one is kept, without Save pressed for it, so it
    // isn't sent for the user again: they pick a version (afterSave).
    if (result === 'stale') keepShown(text);
    // Cancelling mid-save dropped the kept text, but a failed edit reopens the editor with it.
    else if (result === 'failed' && !storedDraft(id)) submit(text);
    setEdit((current) => afterSave(current, result));
  };
  // Saves are counted per draft (fieldSaves), so an editor opened again and the app-wide sync
  // know of the saves a gone editor still has on their way. An older save's answer only says what
  // the tracker had: the latest save decides. One refused because an older save of the edit
  // landed meanwhile was typed over that save's text, which is the base now, so it goes again.
  const dispatch = (text: string, by: SentBy) => {
    const landedBefore = savesOf(id).landed;
    const number = startSave(id, text);
    void request(text, by).then((result) => {
      const saves = savesOf(id);
      finishSave(id, number, result === 'saved');
      if (saves.latest !== number || !mounted.current) return;
      if (result === 'stale' && saves.landed > landedBefore) dispatch(text, by);
      else settle(text, result);
    });
  };
  const send: Send = (text, by) => {
    submit(text);
    setEdit((current) => withPhase(current, 'saving'));
    dispatch(text, by);
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

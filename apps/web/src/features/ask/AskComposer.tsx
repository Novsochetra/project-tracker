import { CHAT_QUESTION_MAX, type AskOptions, type Run, type Runner } from '@tracker/shared';
import clsx from 'clsx';
import { useState, type MouseEvent } from 'react';
import { errorMessage } from '../../api';
import { AutoTextarea } from '../../components';
import { holdPresses } from '../../lib/holdPresses';
import { useDraftMark } from '../../lib/useDraftMark';
import { isSubmitShortcut } from '../ticket/activity/commentRules';
import { AskOptionsRow } from './AskOptionsRow';
import styles from './ChatScreen.module.css';
import { ASK_PLACEHOLDER } from './copy';
import { SendButton } from './SendButton';
import { useAskOptions } from './useAskOptions';
import { useChatSend } from './useChatSend';

export interface AskComposerProps {
  projectKey: string;
  chatId: string | null;
  // The helper that answers; null while none can (thinking, unknown or none online).
  helper: Runner | null;
  // The chat's queued or running question, which Stop takes Send's place for.
  working: Run | null;
  offersSend: boolean;
  savedOptions: AskOptions;
}

export function AskComposer({
  projectKey,
  chatId,
  helper,
  working,
  offersSend,
  savedOptions,
}: AskComposerProps) {
  const [text, setText] = useState('');
  const { options, pick, forget } = useAskOptions(savedOptions);
  const chat = useChatSend(projectKey, chatId, helper);
  useDraftMark(`ask:${chatId ?? `new:${projectKey}`}`, text.trim() !== '');
  const canSend = helper !== null && text.trim() !== '' && !chat.sending;
  const send = () => {
    if (!canSend) return;
    chat.send(text.trim(), options, () => {
      setText('');
      forget();
    });
  };
  // Stop takes Send's place, and the second tap of a double tap must not stop the question.
  const onSend = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) holdPresses(event.currentTarget);
    send();
  };
  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      {chat.error && (
        <p role="alert" className={clsx(styles.error, 'fade-in')}>
          {errorMessage(chat.error)}
        </p>
      )}
      {offersSend && <AskOptionsRow options={options} onChange={pick} />}
      <div className={styles.box}>
        <AutoTextarea
          aria-label="Question for Claude"
          placeholder={ASK_PLACEHOLDER}
          rows={1}
          className={styles.input}
          maxLength={CHAT_QUESTION_MAX}
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (!isSubmitShortcut(event)) return;
            event.preventDefault();
            send();
          }}
        />
        {offersSend && <SendButton working={working} canSend={canSend} onSend={onSend} />}
      </div>
    </form>
  );
}

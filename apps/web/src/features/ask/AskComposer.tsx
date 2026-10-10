import { CHAT_QUESTION_MAX, type AskOptions, type Runner } from '@tracker/shared';
import clsx from 'clsx';
import { ArrowUp } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { errorMessage } from '../../api';
import { AutoTextarea, Button } from '../../components';
import { holdPresses } from '../../lib/holdPresses';
import { useDraftMark } from '../../lib/useDraftMark';
import { isSubmitShortcut } from '../ticket/activity/commentRules';
import { AskOptionsRow } from './AskOptionsRow';
import styles from './ChatScreen.module.css';
import { ASK_PLACEHOLDER } from './copy';
import { useChatSend } from './useChatSend';

export interface AskComposerProps {
  projectKey: string;
  chatId: string | null;
  // The helper that answers; null while none can (thinking, unknown or none online).
  helper: Runner | null;
  offersSend: boolean;
  // The chat's last choice, or the defaults for a new chat.
  initialOptions: AskOptions;
}

export function AskComposer({
  projectKey,
  chatId,
  helper,
  offersSend,
  initialOptions,
}: AskComposerProps) {
  const [text, setText] = useState('');
  const [options, setOptions] = useState(initialOptions);
  const chat = useChatSend(projectKey, chatId, helper);
  useDraftMark(`ask:${chatId ?? `new:${projectKey}`}`, text.trim() !== '');
  const canSend = helper !== null && text.trim() !== '' && !chat.sending;
  const send = () => {
    if (canSend) chat.send(text.trim(), options, () => setText(''));
  };
  // What is pressed next may be the line that takes the thinking state's place.
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
      {offersSend && <AskOptionsRow options={options} onChange={setOptions} />}
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
        {offersSend && (
          <Button
            variant="primary"
            icon={ArrowUp}
            className={styles.send}
            disabled={!canSend}
            onClick={onSend}
          >
            Send
          </Button>
        )}
      </div>
    </form>
  );
}

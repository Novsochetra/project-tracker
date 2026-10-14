import { CHAT_QUESTION_MAX, type AskOptions, type Run, type Runner } from '@tracker/shared';
import clsx from 'clsx';
import { useState, type MouseEvent } from 'react';
import { errorMessage } from '../../api';
import { AutoTextarea } from '../../components';
import { holdPresses } from '../../lib/holdPresses';
import { useDraftMark } from '../../lib/useDraftMark';
import { pasteFiles } from '../attachments/useFileDrop';
import { isSubmitShortcut } from '../ticket/activity/commentRules';
import { AskOptionsRow } from './AskOptionsRow';
import { AttachButton } from './AttachButton';
import styles from './ChatScreen.module.css';
import { QuestionFilesArea } from './QuestionFilesArea';
import { SendButton } from './SendButton';
import { useAskOptions } from './useAskOptions';
import { useChatSend } from './useChatSend';
import { useQuestionFiles } from './useQuestionFiles';

export interface AskComposerProps {
  projectKey: string;
  chatId: string | null;
  // The helper that answers; null while none can (unknown or none online).
  helper: Runner | null;
  stoppableRun: Run | null;
  offersSend: boolean;
  savedOptions: AskOptions;
  placeholder: string;
}

export function AskComposer({
  projectKey,
  chatId,
  helper,
  stoppableRun,
  offersSend,
  savedOptions,
  placeholder,
}: AskComposerProps) {
  const [text, setText] = useState('');
  const { options, pick, forget } = useAskOptions(savedOptions);
  const question = useQuestionFiles();
  const chat = useChatSend(projectKey, chatId, helper);
  useDraftMark(`ask:${chatId ?? `new:${projectKey}`}`, text.trim() !== '' || question.count > 0);
  const canSend = helper !== null && text.trim() !== '' && !chat.sending && !question.uploading;
  const send = () => {
    if (!canSend) return;
    const attachmentIds = question.attachments.map((attachment) => attachment.id);
    chat.send({ text: text.trim(), attachmentIds }, options, () => {
      setText('');
      question.clear();
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
      data-dropping={question.drop.active || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      {...question.drop.handlers}
    >
      {chat.error && (
        <p role="alert" className={clsx(styles.error, 'fade-in')}>
          {errorMessage(chat.error)}
        </p>
      )}
      {offersSend && <AskOptionsRow options={options} onChange={pick} />}
      <QuestionFilesArea question={question} />
      <div className={styles.box}>
        <AttachButton onFiles={question.files.add} />
        <AutoTextarea
          aria-label="Question for Claude"
          placeholder={placeholder}
          rows={1}
          className={styles.input}
          maxLength={CHAT_QUESTION_MAX}
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          onPaste={(event) => pasteFiles(event, question.files.add)}
          onKeyDown={(event) => {
            if (!isSubmitShortcut(event)) return;
            event.preventDefault();
            send();
          }}
        />
        {offersSend && (
          <SendButton
            stoppableRun={stoppableRun}
            hasDraft={text.trim() !== ''}
            canSend={canSend}
            onSend={onSend}
          />
        )}
      </div>
    </form>
  );
}

import {
  QUESTION_ANSWER_MAX,
  type AnswerQuestionInput,
  type TicketQuestion,
} from '@tracker/shared';
import clsx from 'clsx';
import { MessageCircleQuestion } from 'lucide-react';
import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Button, Icon } from '../../components';
import {
  choicesLabel,
  OTHER_PLACEHOLDER,
  otherLabel,
  QUESTION_HEAD,
  SEND_ANSWER_LABEL,
  SKIP_LABEL,
} from './copy';
import { answerOf, NO_PICK, pickChoice, SKIP, typeOther } from './questionAnswer';
import styles from './QuestionCard.module.css';
import { revealActions } from './revealActions';
import type { Answer } from './useAnswerWith';

export interface QuestionAskProps {
  question: TicketQuestion;
  answer: Answer<AnswerQuestionInput>;
}

export function QuestionAsk({ question, answer }: QuestionAskProps) {
  const [pick, setPick] = useState(NO_PICK);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const ready = answerOf(pick);
  const sendReady = (event?: MouseEvent<HTMLElement>) => {
    if (ready) answer.send(ready, event);
  };

  const choose = (label: string, event: MouseEvent<HTMLButtonElement>) => {
    setPick(pickChoice(label));
    answer.send({ answer: label }, event);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;

    event.preventDefault();
    sendReady();
  };

  return (
    <>
      <p className={styles.head}>
        <Icon icon={MessageCircleQuestion} size={14} />
        {QUESTION_HEAD}
      </p>
      <div className={styles.question}>
        <p className={styles.questionText}>{question.text}</p>
        {question.choices.length > 0 && (
          <div role="group" aria-label={choicesLabel(question.text)} className={styles.choices}>
            {question.choices.map((label) => (
              <button
                key={label}
                type="button"
                className={clsx(styles.choice, 'press', pick.chosen === label && styles.selected)}
                disabled={answer.pending}
                onClick={(event) => choose(label, event)}
              >
                <span className={styles.choiceLabel}>{label}</span>
              </button>
            ))}
          </div>
        )}
        <input
          type="text"
          className={styles.other}
          value={pick.other}
          placeholder={OTHER_PLACEHOLDER}
          aria-label={otherLabel(question.text)}
          maxLength={QUESTION_ANSWER_MAX}
          enterKeyHint="send"
          disabled={answer.pending}
          onChange={(event) => setPick(typeOther(pick, event.target.value))}
          onFocus={() => revealActions(buttonsRef.current)}
          onKeyDown={onKeyDown}
        />
      </div>
      <div ref={buttonsRef} className={styles.buttons}>
        <Button
          variant="primary"
          size="lg"
          disabled={!ready || answer.pending}
          onClick={(event) => sendReady(event)}
        >
          {SEND_ANSWER_LABEL}
        </Button>
        <Button
          variant="text"
          size="lg"
          disabled={answer.pending}
          onClick={(event) => answer.send(SKIP, event)}
        >
          {SKIP_LABEL}
        </Button>
      </div>
    </>
  );
}

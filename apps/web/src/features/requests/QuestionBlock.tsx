import { RUN_REQUEST_ANSWER_MAX, type RunQuestion } from '@tracker/shared';
import type { KeyboardEvent, MouseEvent } from 'react';
import { ChoiceButton } from './ChoiceButton';
import { choicesLabel, OTHER_PLACEHOLDER, otherLabel } from './copy';
import type { QuestionPick } from './requestAnswers';
import styles from './Requests.module.css';

export interface QuestionBlockProps {
  question: RunQuestion;
  pick: QuestionPick;
  atOnce: boolean;
  disabled: boolean;
  onChoose: (label: string, event: MouseEvent<HTMLButtonElement>) => void;
  onOther: (text: string) => void;
  onEnter: () => void;
}

const toggleOf = (question: RunQuestion, atOnce: boolean) =>
  atOnce ? null : question.multiSelect ? 'many' : 'one';

export function QuestionBlock(props: QuestionBlockProps) {
  const { question, pick, atOnce, disabled, onChoose, onOther, onEnter } = props;
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onEnter();
  };
  return (
    <div className={styles.question}>
      {question.header && <span className={styles.header}>{question.header}</span>}
      <p className={styles.questionText}>{question.question}</p>
      {question.options.length > 0 && (
        <div role="group" aria-label={choicesLabel(question.question)} className={styles.choices}>
          {question.options.map((option) => (
            <ChoiceButton
              key={option.label}
              option={option}
              toggle={toggleOf(question, atOnce)}
              selected={pick.chosen.includes(option.label)}
              disabled={disabled}
              onClick={(event) => onChoose(option.label, event)}
            />
          ))}
        </div>
      )}
      <input
        type="text"
        className={styles.other}
        value={pick.other}
        placeholder={OTHER_PLACEHOLDER}
        aria-label={otherLabel(question.question)}
        maxLength={RUN_REQUEST_ANSWER_MAX}
        enterKeyHint="send"
        disabled={disabled}
        onChange={(event) => onOther(event.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

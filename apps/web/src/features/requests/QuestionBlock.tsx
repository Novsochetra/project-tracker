import type { RunQuestion } from '@tracker/shared';
import { useId, type KeyboardEvent, type MouseEvent } from 'react';
import { ChoiceButton } from './ChoiceButton';
import { ChoiceRadio } from './ChoiceRadio';
import { choicesLabel, OTHER_PLACEHOLDER, otherLabel } from './copy';
import { otherRoom, type QuestionPick } from './requestAnswers';
import styles from './Requests.module.css';

export interface QuestionBlockProps {
  question: RunQuestion;
  pick: QuestionPick;
  atOnce: boolean;
  disabled: boolean;
  onChoose: (label: string, event?: MouseEvent<HTMLButtonElement>) => void;
  onOther: (text: string) => void;
  onOtherFocus: () => void;
  onEnter: () => void;
}

type ChoicesProps = Pick<
  QuestionBlockProps,
  'question' | 'pick' | 'atOnce' | 'disabled' | 'onChoose'
>;

function SingleChoices({ question, pick, disabled, onChoose }: ChoicesProps) {
  const group = useId();
  return (
    <div role="radiogroup" aria-label={choicesLabel(question.question)} className={styles.choices}>
      {question.options.map((option) => (
        <ChoiceRadio
          key={option.label}
          option={option}
          group={group}
          checked={pick.chosen.includes(option.label)}
          disabled={disabled}
          onPick={() => onChoose(option.label)}
        />
      ))}
    </div>
  );
}

function Choices(props: ChoicesProps) {
  const { question, pick, atOnce, disabled, onChoose } = props;
  if (question.options.length === 0) return null;
  if (!atOnce && !question.multiSelect) return <SingleChoices {...props} />;
  return (
    <div role="group" aria-label={choicesLabel(question.question)} className={styles.choices}>
      {question.options.map((option) => (
        <ChoiceButton
          key={option.label}
          option={option}
          toggle={!atOnce}
          selected={pick.chosen.includes(option.label)}
          disabled={disabled}
          onClick={(event) => onChoose(option.label, event)}
        />
      ))}
    </div>
  );
}

export function QuestionBlock(props: QuestionBlockProps) {
  const { question, pick, disabled, onOther, onOtherFocus, onEnter } = props;
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onEnter();
  };
  return (
    <div className={styles.question}>
      {question.header && <span className={styles.header}>{question.header}</span>}
      <p className={styles.questionText}>{question.question}</p>
      <Choices {...props} />
      <input
        type="text"
        className={styles.other}
        value={pick.other}
        placeholder={OTHER_PLACEHOLDER}
        aria-label={otherLabel(question.question)}
        maxLength={otherRoom(pick.chosen)}
        enterKeyHint="send"
        disabled={disabled}
        onChange={(event) => onOther(event.target.value)}
        onFocus={onOtherFocus}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
